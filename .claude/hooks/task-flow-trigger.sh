#!/usr/bin/env bash
# task-flow-trigger.sh — UserPromptSubmit hook.
#
# Injects the private Jira task-flow pointer ONLY on turns where the user's
# prompt actually puts a Skoda Spot Jira key or a worklog action in play.
#
# WHY (token cost): the old always-on SessionStart injection re-sent this stub
# on every session bootstrap whether or not any Jira work was happening. Firing
# on the prompt instead means the stub costs context only when it is relevant.
#
# Emits nothing (exit 0) when the prompt has no Jira trigger. No-op if the
# private flow doc has been removed.

set -euo pipefail

FLOW="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/private/task-flow.md"
[[ -f "$FLOW" ]] || exit 0

INPUT="$(cat)"
PROMPT="$(printf '%s' "$INPUT" | jq -r '.prompt // empty')"
[[ -z "$PROMPT" ]] && exit 0

# Trigger on a Jira-style key (e.g. FID2507-1028) or a work-tracking verb
# (English + Czech: implement / udělej / vykázat / odepsat / nahlásit / log work).
TRIGGER='([A-Za-z]{2,}[0-9]*-[0-9]+)|implement|impl |uděl|udel|vykáz|vykaz|odepsat|odeps|nahlás|nahlas|worklog|log work|log [0-9]+(h|m)'
if ! printf '%s' "$PROMPT" | grep -qiE "$TRIGGER"; then
  exit 0
fi

CLOCK_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/private/clock"
clock_count=0
if [[ -d "$CLOCK_DIR" ]]; then
  clock_count=$(find "$CLOCK_DIR" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
fi

printf '\n=== PRIVATE JIRA TASK FLOW (trigger) ===\n'
printf 'A Skoda Spot Jira key or worklog action is in play. Read the full flow before acting:\n'
printf '  %s\n' "$FLOW"
printf 'Clocks on disk: %s (list: ls .claude/private/clock/; each is <KEY>.json).\n' "$clock_count"
printf '=== END PRIVATE JIRA TASK FLOW (trigger) ===\n'

exit 0
