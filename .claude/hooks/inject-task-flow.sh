#!/usr/bin/env bash
# SessionStart hook: announce the private GitHub-issue time-tracking flow.
#
# Fires on startup / resume / clear / compact (matched in settings.json).
#
# Token-cost note: the full flow doc (~4.7 KB) and the in-flight clock list
# (~180 entries) used to be dumped verbatim here, so they were re-sent on every
# turn of the session for the whole session. That is the most expensive kind of
# context. We now inject only a compact trigger stub + a clock count; the full
# doc and the clock list are read on demand, only when an issue is in play.
#
# No-op if the private flow doc has been removed.

set -euo pipefail

FLOW="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/private/task-flow.md"

[[ -f "$FLOW" ]] || exit 0

CLOCK_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/private/clock"
clock_count=0
if [[ -d "$CLOCK_DIR" ]]; then
  clock_count=$(find "$CLOCK_DIR" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
fi

printf '\n=== PRIVATE TIME-TRACKING FLOW (trigger) ===\n'
printf 'Time-tracking is active for this repo. The moment a GitHub issue number\n'
printf 'is in play (e.g. "implement #399"), read the full flow before acting:\n'
printf '  %s\n' "$FLOW"
printf 'In-flight clocks: %s (list: ls .claude/private/clock/; each is <issue>.json).\n' "$clock_count"
printf '=== END PRIVATE TIME-TRACKING FLOW (trigger) ===\n'
