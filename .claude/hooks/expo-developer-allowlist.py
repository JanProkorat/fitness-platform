#!/usr/bin/env python3
"""developer-allowlist.py — this pack's per-role PreToolUse[Bash] allowlist
for the `developer` common agent. Restricts Bash to the React Native/Expo
toolchain, git, and read-only file inspection commands only.

WHEN DOES THIS RUN?
  The agent's own (stable, symlinked) frontmatter points at a fixed
  repo-local path, `.claude/hooks/pack-developer-allowlist.py`; onboard
  composes this pack file (and any sibling pack's `developer-allowlist.py`)
  into that repo-local dispatcher — see `common/PACK-CONTRACT.md` §5 and
  `agents/developer.md`. This file is never Bash-wired directly.

WHAT DOES IT DO?
  1. Rejects chained commands (&&, ||, ;, |, &, $(), backticks).
  2. Allows the React Native/Expo toolchain (`npm`, `npx`, `node`, `expo`,
     `eslint`, `tsc`) plus `git status/diff/log/show/add/stash/checkout` and
     read-only file inspection needed for TDD workflows.
  3. Rejects everything else (curl, python3, dotnet, wget, etc.).

OUTPUT
  Denials are communicated via a JSON `permissionDecision` on stdout; this
  hook always exits 0, matching the sibling common hooks in this hub
  (`split-compound-commands.py`, `deny-subagent-merge.py`) and the dotnet/
  react packs' `developer-allowlist.py`.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import date, datetime

LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")

CHAINED_RE = re.compile(r"(\|\||&[^&]|\|[^|]|\$\(|`)")
ALLOW_RE = re.compile(
    r"^(npm|npx|node|expo|eas|eslint|tsc|"
    r"git (status|diff|log|show|add|stash|checkout)|"
    r"ls|cat|head|tail|wc|pwd|grep|find)( .*)?$"
)
DANGEROUS_FIND_RE = re.compile(r"(-exec|-delete|-fls|-printf|-ok)\b")
PATH_GUARDED_CMDS = {"cat", "head", "tail", "grep"}


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def deny(cmd: str, reason: str, message: str) -> int:
    log(f"[{datetime.now().astimezone().isoformat()}] [developer] DENIED: {cmd!r} | reason: {reason!r}")
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
    if "\n" in cmd:
        return deny(cmd, "multiline command", "developer: multiline commands are not allowed.")

    # --- GUARD 1: reject remaining compound operators ---
    # && and ; are handled upstream by split-compound-commands.py; this still
    # blocks ||, |, &, $(), and backticks — no legitimate use in this agent.
    if CHAINED_RE.search(cmd):
        return deny(cmd, "chained command", "developer: chained commands are not allowed.")

    # --- GUARD 2: block read commands that reach outside the project ---
    tokens = cmd.split()
    first_token = tokens[0] if tokens else ""
    if first_token in PATH_GUARDED_CMDS:
        for tok in tokens:
            if tok.startswith("/") or tok.startswith("~") or ".." in tok:
                return deny(
                    cmd, f"path outside project: {tok}",
                    f"developer: {first_token} may only read project-relative paths (no /, ~, or ..).",
                )

    # --- GUARD 3: positive allowlist ---
    if ALLOW_RE.match(cmd):
        basecmd = tokens[0] if tokens else ""
        if basecmd == "find" and DANGEROUS_FIND_RE.search(cmd):
            return deny(cmd, "find with dangerous flag",
                        "developer: find with -exec/-delete/-fls/-printf/-ok is not allowed.")
        return 0

    return deny(
        cmd, "not in allowlist",
        f"developer: '{cmd}' not in allowlist. Allowed: npm, npx, node, expo, eas, eslint, tsc, "
        "git (status/diff/log/show/add/stash/checkout), ls, cat, head, tail, wc, pwd, grep, find.",
    )


if __name__ == "__main__":
    sys.exit(main())
