#!/usr/bin/env python3
"""guard-state-writes.py — only the main thread (conductor) may write shared
pipeline state. Subagents may only write their own handoff file.

WHEN DOES THIS RUN?
  This is a PreToolUse hook for Write and Edit tool calls.
  It only acts on files inside the ".claude/state/" directory — all other
  file writes pass through immediately without inspection.

WHAT DOES IT DO?
  The pipeline uses a shared state file (pipeline.json) that only the conductor
  (main Claude session) should update. If a subagent could write it freely, it
  could corrupt or hijack the pipeline. This hook enforces:
    - Main thread: unrestricted writes to .claude/state/
    - Subagents: ONLY their own handoff file (handoff-<agent-type>.json)
    - Everything else from a subagent: DENY

WHY HANDOFF FILES?
  Handoff files are how subagents communicate results back to the conductor.
  A subagent writes "handoff-developer.json" with its output; the conductor
  reads it, validates it, and updates pipeline.json itself.

EXIT CODES (Claude Code hook contract):
  0 = allow the write to proceed
  (deny is communicated via stdout JSON — exit code stays 0)

Ported 1:1 from guard-state-writes.sh (an earlier project's .claude/hooks).
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import date, datetime

# kit hooks run in many repos — anchor logs to CLAUDE_PROJECT_DIR (falls back to cwd, matching source when unset)
LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or tool_input.get("path") or ""
    agent_id = payload.get("agent_id") or ""
    agent_type = payload.get("agent_type") or payload.get("subagent_type") or ""

    # --- NORMALIZE THE PATH (defense against path-traversal tricks) ---
    # realpath canonicalises the path (resolves .., duplicate slashes, follows
    # existing symlinks) without requiring the file to exist yet — matches the
    # source script's `realpath -m` semantics.
    real_path = os.path.realpath(file_path) if file_path else ""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    state_dir = os.path.realpath(os.path.join(project_dir, ".claude/state"))

    # --- EARLY EXIT: Only act on writes under the canonical .claude/state/ directory.
    # Strict PREFIX check against the normalised path, not a substring match.
    if not real_path.startswith(state_dir + os.sep):
        return 0

    # --- CHECK: Is this the main thread (conductor)? ---
    if not agent_id and not agent_type:
        return 0

    # --- CHECK: Is the subagent writing only its own handoff file? ---
    # Match on the BASENAME (never on an arbitrary tail of the full path) and
    # require the exact filename shape `handoff-<type>.json` or
    # `handoff-<type>-WI-<N>.json`.
    basename = os.path.basename(real_path)
    expected = f"handoff-{agent_type}.json"

    # re.escape() intentionally hardens the source's unescaped-ERE interpolation
    # (bash spliced $AGENT_TYPE straight into the regex) against regex-metacharacter injection.
    if agent_type and re.match(rf"^handoff-{re.escape(agent_type)}(-WI-[0-9]+)?\.json$", basename):
        return 0

    # Fallback: some Claude Code versions use agent_id in the handoff filename
    # instead of agent_type. re.escape() here for the same hardening reason as above.
    if agent_id and re.match(rf"^handoff-{re.escape(agent_id)}(-WI-[0-9]+)?\.json$", basename):
        return 0

    # --- DENY: The subagent is trying to write a state file it doesn't own ---
    log(f"[{datetime.now().astimezone().isoformat()}] guard-state: DENY "
        f"{file_path!r} from agent={agent_type!r} id={agent_id!r}")

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"Subagents may only write to .claude/state/{expected}; "
                "all other state mutations go through the conductor."
            ),
        }
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
