#!/usr/bin/env python3
"""reviewer-allowlist.py — this pack's per-role PreToolUse[Bash] allowlist
for the `impl-reviewer` common agent. Rejects chained commands and anything
outside the allowlist.

WHEN DOES THIS RUN?
  The agent's own (stable, symlinked) frontmatter points at a fixed
  repo-local path, `.claude/hooks/pack-reviewer-allowlist.py`; onboard
  composes this pack file (and any sibling pack's `reviewer-allowlist.py`)
  into that repo-local dispatcher — see `common/PACK-CONTRACT.md` §5 and
  `agents/impl-reviewer.md`. This file is never Bash-wired directly. The
  reviewer should only be able to READ code — never write, delete, or run
  anything with side effects beyond re-running verification.

WHAT DOES IT DO?
  1. Rejects chained shell commands (e.g. "git status && rm -rf /") because
     chaining could smuggle a dangerous command alongside an allowed one.
  2. Allows a specific allowlist of safe, mostly read-only commands, plus
     the narrow slice of the React Native/Expo toolchain needed to re-run
     verification fresh (`npx tsc`, `npx expo-doctor`, `npm run test`,
     `npm test`, bare `tsc`/`eslint`) — mirroring the dotnet/react packs'
     reviewers, which likewise allow only their own stack's verify commands.
  3. Rejects everything else.

OUTPUT
  Denials are communicated via a JSON `permissionDecision` on stdout; this
  hook always exits 0, matching the sibling common hooks in this hub
  (`split-compound-commands.py`, `deny-subagent-merge.py`) and the dotnet/
  react packs' `reviewer-allowlist.py`.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import date, datetime

LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")

# ||, |, &, $(, ` — no legitimate use for a reviewer. && and ; are handled
# upstream by split-compound-commands.py.
CHAINED_RE = re.compile(r"(\|\||&[^&]|\|[^|]|\$\(|`)")
ALLOW_RE = re.compile(
    r"^(git (status|diff|log|show)|"
    r"npm (run test|test)|"
    r"npx (tsc|eslint|expo-doctor)|tsc|eslint|"
    r"wc|ls|cat|head|tail|pwd|grep|find)( .*)?$"
)
DANGEROUS_FIND_RE = re.compile(r"(-exec|-delete|-fls|-printf|-ok)\b")
PATH_GUARDED_CMDS = {"cat", "head", "tail", "grep"}


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def deny(cmd: str, reason: str, message: str) -> int:
    log(f"[{datetime.now().astimezone().isoformat()}] [reviewer] DENIED: {cmd!r} | reason: {reason!r}")
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": message,
        }
    }))
    return 0


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if not cmd:
        return 0

    # --- GUARD 0: reject multiline commands ---
    # A newline is effectively a command separator; the per-line allowlist
    # below would match on any single line, hiding a forbidden command on a
    # second line ("git status\ncat ~/.ssh/id_rsa").
    if "\n" in cmd:
        return deny(cmd, "multiline command",
                    "impl-reviewer: multiline commands are not allowed (run one command at a time).")

    # --- GUARD 1: reject remaining compound operators ---
    if CHAINED_RE.search(cmd):
        return deny(cmd, "chained command", "impl-reviewer: chained shell commands are not allowed.")

    # --- GUARD 2: reject absolute paths, home refs, and parent traversal in read commands ---
    tokens = cmd.split()
    first_token = tokens[0] if tokens else ""
    if first_token in PATH_GUARDED_CMDS:
        for tok in tokens:
            if tok.startswith("/") or tok.startswith("~") or ".." in tok:
                return deny(
                    cmd, f"path {tok} in command",
                    f"impl-reviewer: {first_token} may only read project-relative paths (no /, ~, or ..).",
                )

    # --- GUARD 3: allowlist of safe commands ---
    if ALLOW_RE.match(cmd):
        basecmd = tokens[0] if tokens else ""
        if basecmd == "find" and DANGEROUS_FIND_RE.search(cmd):
            return deny(cmd, "find-dangerous-flag",
                        "impl-reviewer: find with -exec/-delete/-fls/-printf/-ok is not allowed.")
        return 0

    return deny(
        cmd, "not in allowlist",
        "impl-reviewer: command not in allowlist (git status/diff/log/show, "
        "npm run test/test, npx tsc/eslint/expo-doctor, tsc, eslint, "
        "wc, ls, cat, head, tail, pwd, grep, find).",
    )


if __name__ == "__main__":
    sys.exit(main())
