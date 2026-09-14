#!/usr/bin/env python3
"""build-on-submit.py — UserPromptSubmit hook: at the start of each turn,
check whether the background build spawned by `build-on-stop.py` has
finished. If it failed, surface the errors on stderr so Claude sees them in
the new turn's context.

Always exits 0 — never blocks the user's prompt.

Escape hatch:
  DOTNET_PACK_BUILD_STALE_AFTER=<seconds>  give up waiting after this long
                                             (default 600) and clear state.

Ported from build-on-submit.sh (an earlier project's .claude/hooks), generalized
so the failure-classification messages point at the repo's own `CLAUDE.md`
for repo-specific known traps instead of hardcoding one consuming repo's
package/namespace quirks — see `common/PACK-CONTRACT.md`. `MSB3021` is kept
verbatim: the self-nested `bin/` output-folder trap it flags is a general
MSBuild/dotnet failure mode, not specific to any one repo.
"""
from __future__ import annotations

import os
import sys
from datetime import date, datetime


def log(log_dir: str, msg: str) -> None:
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def cleanup(state_dir: str) -> None:
    for name in ("build.done", "build.log", "build.pid", "build.started"):
        try:
            os.remove(os.path.join(state_dir, name))
        except OSError:
            pass


def main() -> int:
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    state_dir = os.path.join(project_dir, ".claude/.build-state")
    log_dir = os.path.join(project_dir, ".claude/hooks/log")

    started_file = os.path.join(state_dir, "build.started")
    if not os.path.isdir(state_dir) or not os.path.isfile(started_file):
        return 0

    stale_after = int(os.environ.get("DOTNET_PACK_BUILD_STALE_AFTER", "600"))

    done_file = os.path.join(state_dir, "build.done")
    log_file = os.path.join(state_dir, "build.log")
    pid_file = os.path.join(state_dir, "build.pid")

    now_iso = datetime.now().astimezone().isoformat()

    # ── Still running? Decide from ELAPSED TIME, not a liveness probe ────────
    # The pid file is written by the spawned shell a few ms after the spawn
    # returns, so probing it immediately would report a live build as dead —
    # and deleting state on that false read would discard the very log this
    # hook is about to read on the next turn.
    if not os.path.isfile(done_file):
        try:
            started_at = int(open(started_file).read().strip() or "0")
        except (OSError, ValueError):
            started_at = 0
        elapsed = int(datetime.now().timestamp()) - started_at

        if elapsed < stale_after:
            sys.stderr.write(
                f"[build] background dotnet build still running (~{elapsed}s elapsed). "
                f"Result will surface next turn.\n"
            )
            return 0

        if os.path.isfile(pid_file):
            try:
                pid = int(open(pid_file).read().strip() or "0")
            except (OSError, ValueError):
                pid = 0
            if pid:
                try:
                    os.kill(pid, 15)
                except OSError:
                    pass

        log(log_dir, f"[{now_iso}] build-on-submit: abandoned after {elapsed}s")
        cleanup(state_dir)
        return 0

    try:
        exit_code = open(done_file).read().strip() or "?"
    except OSError:
        exit_code = "?"

    if exit_code == "0":
        log(log_dir, f"[{now_iso}] build-on-submit: clean")
        cleanup(state_dir)
        return 0

    # ── Failed. Classify before reporting. ───────────────────────────────────
    try:
        with open(log_file, errors="replace") as f:
            build_log = f.read()
    except OSError:
        build_log = ""

    lines: list[str] = [f"[build] background dotnet build FAILED (exit={exit_code})."]

    if "MSB3021" in build_log:
        lines += [
            "[build] MSB3021 detected — a common self-nested output-folder trap:",
            "        bin/<config>/<tfm>/bin has accumulated a copy of itself and paths",
            "        exceed the limit. `dotnet clean` does not remove it (it is not",
            "        tracked by MSBuild's clean manifest). Fix: delete the nested",
            "        folder, then rebuild. Not necessarily a defect in your change —",
            "        check whether the repo's own CLAUDE.md documents this trap.",
        ]

    import re
    if re.search(r"\bNU1\d{3}\b", build_log):
        lines += [
            "[build] NU-series advisory warning present — check the repo's own",
            "        CLAUDE.md / dotnet-verify skill for any documented known transitive",
            "        advisory before treating this as your defect. Do not",
            "        silence it with NoWarn or bump the package as a side effect of",
            "        unrelated work (`skills/dotnet-verify/SKILL.md`).",
        ]

    error_lines = re.findall(r".*error (?:CS|MSB|NU|AD)\d+.*", build_log)
    if error_lines:
        lines.append("[build] Errors (first 30):")
        lines.extend(error_lines[:30])
    else:
        lines.append("[build] No recognised error lines; last 30 lines:")
        tail = build_log.splitlines()[-30:] if build_log else ["(no output captured)"]
        lines.extend(tail)

    lines.append("[build] Fix before declaring the task done — skills/dotnet-verify/SKILL.md.")

    sys.stderr.write("\n".join(lines) + "\n")

    log(log_dir, f"[{now_iso}] build-on-submit: FAILED exit={exit_code}")
    cleanup(state_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
