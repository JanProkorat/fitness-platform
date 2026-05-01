#!/usr/bin/env bash
# deny-subagent-merge.sh — PreToolUse[Bash] hook.
#
# Prevent any subagent from running `gh pr merge` or `git push --force`.
# Convention says only `pr-reviewer` (under orchestrator direction) merges,
# and only the orchestrator force-pushes (rare). A misbehaving prompt could
# merge prematurely; this hook is the belt to convention's braces.
#
# DETECTION:
#   Claude Code passes `agent_id` / `agent_type` / `subagent_type` in the
#   JSON payload when a subagent is running. If any are present, this is
#   not the main thread.
#
# OUTPUT:
#   When a subagent attempts a forbidden command, emit a JSON deny
#   payload (Claude Code parses stdout for the permission decision).
#
# EXIT CODE:
#   Always 0 — decision communicated via stdout JSON, not exit code.

set -euo pipefail

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/log"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%F).log"

INPUT="$(cat)"

CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
[ -z "$CMD" ] && exit 0

AGENT_ID="$(printf '%s' "$INPUT" | jq -r '.agent_id // empty')"
AGENT_TYPE="$(printf '%s' "$INPUT" | jq -r '.agent_type // .subagent_type // empty')"
TRANSCRIPT="$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')"

# Detect subagent context.
IS_SUBAGENT="false"
if [[ -n "$AGENT_ID" || -n "$AGENT_TYPE" ]]; then
    IS_SUBAGENT="true"
elif [[ "$TRANSCRIPT" == */subagent/* ]]; then
    # Fallback: older Claude Code versions without explicit fields.
    IS_SUBAGENT="true"
fi

# Main thread can do anything (still bound by the project's `deny`/`ask`
# lists in settings.json). Only filter subagent traffic.
[ "$IS_SUBAGENT" = "false" ] && exit 0

# Patterns we refuse from subagent context.
# `gh pr merge`            — merging PRs is pr-reviewer's job, dispatched by
#                            the orchestrator from the main thread.
# `git push * --force*`    — never from a subagent; main thread only with
#                            explicit user authorization.
# `git push * -f *`        — same as --force, short flag form.
DENY_REGEX='^(gh pr merge( |$)|git push .*( --force| --force-with-lease| -f )( |$|.*))'

if printf '%s' "$CMD" | grep -qE "$DENY_REGEX"; then
    REASON="Forbidden in subagent context: ${AGENT_TYPE:-unknown-subagent} attempted '${CMD}'. Merging PRs and force-pushing are main-thread-only operations. Return to the orchestrator and let it dispatch pr-reviewer."

    printf '[%s] deny-subagent-merge: %s blocked: %q\n' \
        "$(date -Iseconds)" "${AGENT_TYPE:-unknown}" "$CMD" >> "$LOG"

    jq -n --arg reason "$REASON" \
        '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
fi

exit 0
