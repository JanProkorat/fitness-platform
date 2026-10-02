#!/usr/bin/env python3
"""deny-subagent-merge.py — PreToolUse[Bash] hook.

Prevent any subagent from pushing branches or merging PRs.

WHY THIS EXISTS
  Pushing and merging are main-thread operations in this repo. pr-reviewer
  opens PRs and *clears* merges (CI on the exact head, exclusion list,
  strategy), then hands back a pinned `gh pr merge … --match-head-commit`
  command; the main thread runs it (rules/merge-strategy.md, .claude/CLAUDE.md
  rule 8). A misbehaving prompt could push or merge prematurely; this hook is
  the belt to convention's braces.

  It is the sibling of deny-non-main.sh (which blocks subagent `git commit`):
  same subagent-detection, different forbidden verbs.

DETECTION
  Claude Code passes agent_id / agent_type / subagent_type in the JSON payload
  when a subagent is running. If any is present, this is not the main thread.
  Fallback: subagent transcripts live under a "/subagent/" path.

OUTPUT
  When a subagent attempts a forbidden command, emit a JSON deny payload on
  stdout (Claude Code parses stdout for the permission decision). Always
  exit 0 — the decision is carried by the JSON, not the exit code.

Ported 1:1 from deny-subagent-merge.sh (an earlier project's .claude/hooks).
"""
from __future__ import annotations

import json
import os
import re
import shlex
import sys
from datetime import date, datetime

LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


# Verbs refused from subagent context. The remote is GitHub; the `az repos`
# patterns are inherited from an Azure DevOps project and kept as harmless
# belt-and-braces. `gh pr create` is deliberately NOT here — pr-reviewer
# opens PRs.
#   git push …               — subagents never push; the main thread pushes.
#   az repos pr create …     — Azure DevOps PR open (inherited).
#   az repos pr update …     — Azure DevOps PR complete/abandon (inherited).
#   gh pr merge …            — merging is the main thread's job.
DENY_REGEX = re.compile(
    r"^\s*(git\s+push(\s|$)|az\s+repos\s+pr\s+(create|update)(\s|$)|gh\s+pr\s+merge(\s|$))"
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if not cmd:
        return 0

    agent_id = payload.get("agent_id") or ""
    agent_type = payload.get("agent_type") or payload.get("subagent_type") or ""
    transcript = payload.get("transcript_path") or ""

    # Detect subagent context.
    is_subagent = bool(agent_id or agent_type) or "/subagent/" in transcript

    # Main thread can do anything (still bound by settings.json deny/ask lists).
    # Only filter subagent traffic.
    if not is_subagent:
        return 0

    if DENY_REGEX.search(cmd):
        agent_label = agent_type or "unknown-subagent"
        reason = (
            f"Forbidden in subagent context: {agent_label} attempted '{cmd}'. "
            "Pushing branches and merging PRs are main-thread operations in "
            "this repo (rules/merge-strategy.md). Do not work around this. "
            "Finish your checks and hand back the exact command (for a merge: "
            "`gh pr merge <n> <strategy> --delete-branch --match-head-commit "
            "<sha>`); the orchestrator runs it."
        )

        log(f"[{datetime.now().astimezone().isoformat()}] deny-subagent-merge: "
            f"{shlex.quote(agent_type or 'unknown')} blocked: {shlex.quote(cmd)}")

        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }))

    return 0


if __name__ == "__main__":
    sys.exit(main())
