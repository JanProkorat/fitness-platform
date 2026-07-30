#!/usr/bin/env python3
"""gate-check.py — after a subagent returns, verify the conductor updated
pipeline state. Runs on SubagentStop. Non-blocking advisory; logs anomalies.

WHEN DOES THIS RUN?
  Claude Code fires "SubagentStop" each time a spawned sub-agent finishes its work
  and control returns to the main (conductor) session.

WHAT DOES IT DO?
  It checks how recently the shared pipeline state file was modified.
  If it looks stale (not touched in the last 2 minutes), it logs a warning.
  This is advisory only — it never blocks anything; it just records anomalies.

HOW DOES CLAUDE CODE CALL THIS?
  Claude Code passes a JSON payload on stdin describing the stopped agent.
  We read that JSON, extract the agent name, then inspect the state file's age.

Ported 1:1 from gate-check.sh (an earlier project's .claude/hooks).
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import date, datetime

# Log path uses CLAUDE_PROJECT_DIR (the common-layer logging convention);
# STATE stays relative, matching the source script's behavior exactly.
# kit hooks run in many repos — anchor logs to CLAUDE_PROJECT_DIR (falls back to cwd, matching source when unset)
LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")
STATE = ".claude/state/pipeline.json"


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}

    agent = payload.get("agent_type")
    if agent is None:
        agent = payload.get("subagent_type")
    if agent is None:
        agent = "unknown"

    now_iso = datetime.now().astimezone().isoformat()

    if not os.path.isfile(STATE):
        log(f"[{now_iso}] gate-check: no pipeline.json after {agent} returned")
        return 0

    try:
        state_mtime = os.stat(STATE).st_mtime
    except OSError:
        state_mtime = 0

    now = time.time()
    age = int(now - state_mtime)

    if age > 120:
        log(f"[{now_iso}] gate-check: WARN pipeline.json is {age}s old after {agent} returned")

    return 0


if __name__ == "__main__":
    sys.exit(main())
