#!/usr/bin/env python3
"""protect-specs.py — block edits to approved specs; allow in-progress ones.
Runs on PreToolUse for Write|Edit.

WHEN DOES THIS RUN?
  Claude Code fires this hook before any Write or Edit tool call.
  The hook inspects which file is about to be written/edited and decides
  whether to allow or deny the operation.

WHAT DOES IT DO?
  Specs in "docs/specs/approved/" are considered locked/frozen.
  If Claude (or a subagent) tries to modify one, this hook blocks the write
  and explains why. Specs in "docs/specs/in-progress/" are still fair game.

EXIT CODES (Claude Code hook contract):
  0 = allow the tool call to proceed
  2 = deny the tool call (Claude Code shows the stderr message to the user)

Ported 1:1 from protect-specs.sh (an earlier project's .claude/hooks).
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime

# kit hooks run in many repos — anchor logs to CLAUDE_PROJECT_DIR (falls back to cwd, matching source when unset)
LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def deny(reason: str, file_path: str) -> int:
    log(f"[{datetime.now().astimezone().isoformat()}] protect-specs: DENY "
        f"{reason!r} for {file_path!r}")
    sys.stderr.write("Approved specs are read-only. Move to docs/specs/in-progress/ first.\n")
    return 2


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or tool_input.get("path") or ""

    if not file_path:
        return 0

    # --- GUARD 1: Reject symlinks outright. ---
    # A symlink in docs/specs/in-progress/ that points into docs/specs/approved/
    # would let a subagent write to an approved file without its path containing
    # "approved/" literally. Easier to reject all symlink targets than to chase
    # resolution races.
    if os.path.islink(file_path):
        return deny("symlink target", file_path)

    # --- GUARD 2: Normalise the path before checking. ---
    real_path = os.path.realpath(file_path)
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    approved_dir = os.path.realpath(os.path.join(project_dir, "docs/specs/approved"))

    # --- GUARD 3: Strict prefix check against the canonical approved directory. ---
    # Substring matches on the raw path are unsafe. Require the normalised path
    # to live under the canonical approved_dir root.
    if real_path.startswith(approved_dir + os.sep):
        return deny("normalised path under approved/", file_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
