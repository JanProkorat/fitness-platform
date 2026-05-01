#!/usr/bin/env bash
# gate-check.sh — SubagentStop hook.
#
# Runs after every Agent dispatch returns to the orchestrator. If the
# subagent wrote a handoff file under .claude/state/handoff-*.json,
# validate it against its declared schema before letting control flow
# back. A schema-violating handoff exits non-zero so the agent sees
# the error and self-corrects.
#
# How we find the handoff:
#   The hook receives a JSON payload on stdin. It includes agent_id /
#   agent_type / transcript_path. We look for the most-recently-modified
#   handoff file in .claude/state/ that matches the agent_type prefix.
#   If none exists for the just-finished agent, we exit cleanly — not
#   every subagent dispatch produces a handoff (e.g. ad-hoc Explore
#   queries).

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LOG_DIR="$PROJECT_DIR/.claude/hooks/log"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%F).log"

INPUT="$(cat)"

# Extract agent type/id (best effort — fields may be absent on older Claude
# Code versions). Sanitise so a hostile value can't reach the shell.
AGENT_TYPE="$(printf '%s' "$INPUT" | jq -r '.agent_type // .subagent_type // empty' 2>/dev/null | tr -dc '[:alnum:]_-' | head -c 50)"
AGENT_ID="$(printf '%s'   "$INPUT" | jq -r '.agent_id // empty'                       2>/dev/null | tr -dc '[:alnum:]_-' | head -c 80)"

# Map agent type → handoff filename prefix. Unknown agent types skip.
case "$AGENT_TYPE" in
    backend-dotnet|web-react|mobile-expo)
        prefix="handoff-dev-"
        ;;
    qa-tester)
        prefix="handoff-qa-"
        ;;
    pr-reviewer)
        prefix="handoff-review-"
        ;;
    design-reviewer)
        prefix="handoff-design-"
        ;;
    *)
        # No matching agent type — main thread, Explore, general-purpose, etc.
        # Nothing to validate.
        exit 0
        ;;
esac

STATE_DIR="$PROJECT_DIR/.claude/state"
[ -d "$STATE_DIR" ] || exit 0

# Find the most recently modified handoff file for this agent type.
# Use find + stat for portability across BSD (macOS) and GNU.
LATEST=""
LATEST_MTIME=0

# Loop over candidates safely (no glob expansion if dir is empty).
shopt -s nullglob
for f in "$STATE_DIR"/${prefix}*.json; do
    [ -f "$f" ] || continue
    # macOS uses `stat -f %m`; GNU uses `stat -c %Y`. Try both.
    if mtime=$(stat -f %m "$f" 2>/dev/null); then
        :
    elif mtime=$(stat -c %Y "$f" 2>/dev/null); then
        :
    else
        continue
    fi
    if [ "$mtime" -gt "$LATEST_MTIME" ]; then
        LATEST_MTIME="$mtime"
        LATEST="$f"
    fi
done
shopt -u nullglob

if [ -z "$LATEST" ]; then
    # Subagent finished without writing a handoff. The plan requires
    # them to do so — flag it to the orchestrator via stderr but don't
    # block (yet — promotion to a hard failure is a future tightening).
    printf '[%s] gate-check: %s finished WITHOUT writing %s*.json — orchestrator may proceed but flag missing handoff to next dispatch\n' \
        "$(date -Iseconds)" "${AGENT_TYPE:-unknown}" "$prefix" >> "$LOG"
    exit 0
fi

# Validate via Python validator. Capture both stdout (success) and
# stderr (failure diagnostics). On non-zero exit, propagate the error
# to Claude Code so the agent sees it and self-corrects.
if python3 "$PROJECT_DIR/.claude/hooks/validate-handoff.py" "$LATEST" 1>/dev/null 2>/tmp/gate-check.err; then
    printf '[%s] gate-check: %s OK (%s)\n' \
        "$(date -Iseconds)" "${AGENT_TYPE:-unknown}" "$(basename "$LATEST")" >> "$LOG"
    rm -f /tmp/gate-check.err
    exit 0
else
    EXIT_CODE=$?
    printf '[%s] gate-check: %s REJECTED (%s)\n' \
        "$(date -Iseconds)" "${AGENT_TYPE:-unknown}" "$(basename "$LATEST")" >> "$LOG"
    cat /tmp/gate-check.err >&2
    cat /tmp/gate-check.err >> "$LOG"
    rm -f /tmp/gate-check.err
    # Propagate failure so Claude Code surfaces the error to the agent.
    exit "$EXIT_CODE"
fi
