#!/usr/bin/env python3
"""designer-allowlist.py — this pack's per-role PreToolUse[Bash] allowlist
for the `designer` common agent. Restricts Bash to read-only inspection
commands (no writes, no builds, no network, no npm toolchain).

WHEN DOES THIS RUN?
  The agent's own (stable, symlinked) frontmatter points at a fixed
  repo-local path, `.claude/hooks/pack-designer-allowlist.py`; onboard
  composes this pack file (and any sibling pack's `designer-allowlist.py`)
  into that repo-local dispatcher — see `common/PACK-CONTRACT.md` §5 and
  `agents/designer.md`. This file is never Bash-wired directly.

WHAT DOES IT DO?
  The designer only needs to inspect the codebase to understand existing
  patterns. It never builds, never runs the React/TS toolchain, never
  stages files. This hook enforces that — no `npm`/`npx`/`node`/`eslint`/
  `tsc`/`vite` in the allowlist, mirroring the dotnet pack's designer
  (which likewise excludes `dotnet`).

OUTPUT
  Denials are communicated via a JSON `permissionDecision` on stdout (Claude
  Code parses stdout for the decision); this hook always exits 0, matching
  the sibling common hooks in this hub (`split-compound-commands.py`,
  `deny-subagent-merge.py`) and the dotnet pack's `designer-allowlist.py`.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import date, datetime

LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")

# --- GUARD 1: chained/pipe/substitution operators ---
# && and ; are handled upstream by split-compound-commands.py (quote-aware
# parser). This still blocks ||, |, &, $(), and backticks — operators that
# split-compound-commands deliberately leaves intact and that a read-only
# designer agent has no legitimate reason to use.
CHAINED_RE = re.compile(r"(\|\||&[^&]|\|[^|]|\$\(|`)")

# --- GUARD 3: positive allowlist — read-only inspection only ---
ALLOW_RE = re.compile(r"^(git (status|diff|log|show|branch)|ls|cat|head|tail|wc|pwd|grep|find)( .*)?$")
DANGEROUS_FIND_RE = re.compile(r"(-exec|-delete|-fls|-printf|-ok)\b")
PATH_GUARDED_CMDS = {"cat", "head", "tail", "grep"}


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def deny(cmd: str, reason: str, message: str) -> int:
    log(f"[{datetime.now().astimezone().isoformat()}] [designer] DENIED: {cmd!r} | reason: {reason!r}")
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
    # Newlines act as command separators; the per-line allowlist below could
    # match a benign first line while hiding a forbidden command on the next.
    if "\n" in cmd:
        return deny(cmd, "multiline command", "designer: multiline commands are not allowed.")

    if CHAINED_RE.search(cmd):
        return deny(cmd, "chained command", "designer: chained commands are not allowed.")

    # --- GUARD 2: block read commands that reach outside the project ---
    tokens = cmd.split()
    first_token = tokens[0] if tokens else ""
    if first_token in PATH_GUARDED_CMDS:
        for tok in tokens:
            if tok.startswith("/") or tok.startswith("~") or ".." in tok:
                return deny(
                    cmd, f"path outside project: {tok}",
                    f"designer: {first_token} may only read project-relative paths (no /, ~, or ..).",
                )

    if ALLOW_RE.match(cmd):
        basecmd = tokens[0] if tokens else ""
        if basecmd == "find" and DANGEROUS_FIND_RE.search(cmd):
            return deny(cmd, "find with dangerous flag",
                        "designer: find with -exec/-delete/-fls/-printf/-ok is not allowed.")
        return 0

    return deny(
        cmd, "not in allowlist",
        f"designer: '{cmd}' not in allowlist. Allowed: git (status/diff/log/show/branch), "
        "ls, cat, head, tail, wc, pwd, grep, find.",
    )


if __name__ == "__main__":
    sys.exit(main())
