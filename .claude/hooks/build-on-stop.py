#!/usr/bin/env python3
"""build-on-stop.py — Stop hook: after Claude finishes a turn, spawn `dotnet
build` in the BACKGROUND if the turn touched C# / project files. Returns in
well under a second so the Stop event is never blocked.

The paired hook `build-on-submit.py` (UserPromptSubmit) reads the result at
the start of the next turn and surfaces failures to Claude's context.

WHY:
  A solution build commonly takes several seconds warm. Running it
  synchronously on Stop would add that to the end of every turn touching
  `.cs`. Backgrounding makes the latency invisible — failures arrive next
  turn.

  This is the ambient net behind `dotnet-verify`/`dotnet-build`
  (`common/PACK-CONTRACT.md`, `rules/verification-contract.md#stack-verify-skills`):
  it does not replace a work item's declared `verification`, it catches the
  case where nobody ran anything at all.

DELIBERATELY NOT `-warnaserror`:
  Adopting `-warnaserror` as an ambient gate risks a check that can never go
  green on a repo carrying a pre-existing warning/advisory backlog — that
  teaches everyone to ignore it. See `skills/dotnet-verify/SKILL.md` and
  `skills/dotnet-build/SKILL.md`.

State:
  $STATE_DIR/build.log     — captured dotnet output
  $STATE_DIR/build.pid     — pid of the spawned shell (written by itself)
  $STATE_DIR/build.started — epoch seconds
  $STATE_DIR/build.done    — created on completion, contains the exit code

Escape hatches:
  DOTNET_PACK_SKIP_BUILD=1    skip entirely
  DOTNET_PACK_VERIFY_TESTS=1  also run a test project after a clean build —
                               requires DOTNET_PACK_TEST_PROJECT to name it;
                               this pack does not hardcode any repo's test
                               project path.

Ported from build-on-stop.sh (an earlier project's .claude/hooks), generalized
so it does not hardcode a repo-specific solution/test-project name — see
`common/PACK-CONTRACT.md` (a pack must not bake in one consuming repo's
facts).
"""
from __future__ import annotations

import glob
import os
import re
import shutil
import subprocess
import sys
from datetime import date, datetime


def log(log_dir: str, msg: str) -> None:
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def main() -> int:
    if os.environ.get("DOTNET_PACK_SKIP_BUILD", "0") == "1":
        return 0

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()

    if shutil.which("git") is None or shutil.which("dotnet") is None:
        return 0

    try:
        os.chdir(project_dir)
    except OSError:
        return 0

    is_repo = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        capture_output=True, text=True,
    )
    if is_repo.returncode != 0:
        return 0

    log_dir = os.path.join(project_dir, ".claude/hooks/log")
    now_iso = datetime.now().astimezone().isoformat()

    state_dir = os.path.join(project_dir, ".claude/.build-state")
    os.makedirs(state_dir, exist_ok=True)

    # ── Did this turn touch anything that needs compiling? ──────────────────
    # -uall: list untracked files individually. Without it git collapses an
    # untracked directory to "src/.../NewFeature/", which matches no extension
    # below — so a brand-new vertical slice would never be built.
    status = subprocess.run(
        ["git", "status", "--porcelain", "-uall"],
        capture_output=True, text=True,
    )
    changed = False
    exts = (".cs", ".csproj", ".slnx", ".sln", ".props", ".targets")
    for line in (status.stdout or "").splitlines():
        if not line:
            continue
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ")[-1]
        path = path.strip('"')
        if path.endswith(exts):
            changed = True
            break

    if not changed:
        log(log_dir, f"[{now_iso}] build-on-stop: no C# changes — nothing to build")
        return 0

    # ── Locate the solution ─────────────────────────────────────────────────
    # .slnx first: many repos on the newer XML solution format have moved off
    # .sln entirely. A glob that only matched *.sln would silently find
    # nothing and skip every build.
    solution = None
    for pattern in ("*.slnx", "*.sln"):
        matches = sorted(glob.glob(os.path.join(project_dir, pattern)))
        if matches:
            solution = matches[0]
            break

    if solution is None:
        log(log_dir, f"[{now_iso}] build-on-stop: no .slnx/.sln at project root — skipped")
        return 0

    # ── Refuse an unsafe solution name BEFORE it reaches a shell ─────────────
    # `git mv` is on the Bash allowlist, and this hook fires on Stop — after
    # every PreToolUse gate (bash allowlists, split-compound-commands,
    # permissions.deny) has already run for the turn. A solution/path name is
    # therefore attacker-influenceable, and this hook builds a `bash -c`
    # command below. Allowlist the characters a real .NET solution file name
    # uses and refuse everything else, rather than blacklisting metacharacters
    # — a blacklist is easy to get wrong in a way that silently lets an
    # unsafe name through.
    solution_basename = os.path.basename(solution)
    if re.search(r"[^A-Za-z0-9._ -]", solution_basename):
        log(log_dir, f"[{now_iso}] build-on-stop: refusing solution name outside "
                      f"[A-Za-z0-9._ -]: {solution_basename!r}")
        return 0

    # ── Reap any previous run ────────────────────────────────────────────────
    pid_file = os.path.join(state_dir, "build.pid")
    if os.path.isfile(pid_file):
        try:
            old_pid = int(open(pid_file).read().strip() or "0")
        except (OSError, ValueError):
            old_pid = 0
        if old_pid:
            try:
                os.kill(old_pid, 15)  # SIGTERM; best-effort, no process-group reap without setsid
            except OSError:
                pass

    for name in ("build.pid", "build.done", "build.log", "build.started"):
        try:
            os.remove(os.path.join(state_dir, name))
        except OSError:
            pass

    with open(os.path.join(state_dir, "build.started"), "w") as f:
        f.write(str(int(datetime.now().timestamp())))

    run_tests = "0"
    test_project = ""
    if os.environ.get("DOTNET_PACK_VERIFY_TESTS", "0") == "1":
        test_project = os.environ.get("DOTNET_PACK_TEST_PROJECT", "")
        if test_project:
            run_tests = "1"
        else:
            log(log_dir, f"[{now_iso}] build-on-stop: DOTNET_PACK_VERIFY_TESTS=1 but "
                          f"DOTNET_PACK_TEST_PROJECT is unset — running build only")

    # The script body below is a FIXED, single-quoted-at-the-Python-level
    # string with NO Python-variable interpolation — state_dir, project_dir,
    # solution, and test_project arrive as positional shell parameters
    # ($1..$5) via argv, never substituted into the command text. Do not
    # "simplify" this back to an f-string: this hook runs on Stop, downstream
    # of every PreToolUse gate, so an interpolated path/solution name would
    # inject shell after every earlier gate has already passed (see the
    # allowlist check above this hook added for the same reason).
    #
    # Records its OWN pid ($$) inside the spawned shell, not the Popen pid:
    # this mirrors the source script's note that on macOS (no `setsid`) the
    # spawned shell is the process to probe, not a short-lived wrapper.
    #
    # The build+test work runs in an inner subshell so an early failure (e.g.
    # a bad `cd`) still lands inside it — the done marker is written on every
    # path, not just the success path.
    inner_script = (
        'state_dir="$1"; proj="$2"; sln="$3"; run_tests="$4"; test_proj="$5"; '
        'printf "%s" "$$" > "$state_dir/build.pid"; '
        '('
        'cd "$proj" || exit 1; '
        'dotnet build "$sln" --nologo -v q -clp:NoSummary || exit $?; '
        '[ "$run_tests" = "1" ] || exit 0; '
        '[ -n "$test_proj" ] || exit 0; '
        'dotnet test "$test_proj" --nologo -v q --no-build'
        ') > "$state_dir/build.log" 2>&1; '
        'code=$?; '
        'printf "%s" "$code" > "$state_dir/build.done.tmp" '
        '&& mv "$state_dir/build.done.tmp" "$state_dir/build.done"'
    )

    # macOS does NOT ship `setsid` (it is util-linux) — a hook that spawns
    # through it on a Mac fails silently, because this hook's stderr is
    # discarded, so the background job simply never starts. `nohup` plus
    # `start_new_session` (Python's equivalent of `disown`ing after `&`) is
    # enough to survive this hook process exiting.
    try:
        subprocess.Popen(
            ["nohup", "bash", "-c", inner_script, "_",
             state_dir, project_dir, solution, run_tests, test_project],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        log(log_dir, f"[{now_iso}] build-on-stop: failed to spawn nohup — skipped")
        return 0

    log(log_dir, f"[{now_iso}] build-on-stop: spawned build of "
                  f"{os.path.basename(solution)} (tests={os.environ.get('DOTNET_PACK_VERIFY_TESTS', '0')})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
