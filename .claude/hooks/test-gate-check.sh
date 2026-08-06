#!/usr/bin/env bash
# Behavioural test for gate-check.sh (#910). Builds a throwaway project dir so
# the real .claude/state is never touched.
set -uo pipefail

# Resolve relative to this script, not an absolute path — otherwise running it
# from a worktree silently tests the MAIN tree's copy of the hook, which is a
# different file. (Caught exactly that way: the suite passed in one tree and
# failed in another because it was never testing the hook next to it.)
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL_HOOK="$HOOKS_DIR/gate-check.sh"
REAL_VALIDATOR="$HOOKS_DIR/validate-handoff.py"
REAL_SCHEMAS="$HOOKS_DIR/../schemas"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/.claude/hooks" "$TMP/.claude/state" "$TMP/.claude/schemas"
cp "$REAL_HOOK" "$TMP/.claude/hooks/"
cp "$REAL_VALIDATOR" "$TMP/.claude/hooks/"
cp -R "$REAL_SCHEMAS/." "$TMP/.claude/schemas/"

FAILURES=0
pass() { echo "  ok    $1"; }
fail() { echo "  FAIL  $1 — $2"; FAILURES=$((FAILURES + 1)); }

# A deliberately INVALID handoff belonging to some earlier, unrelated run.
cat > "$TMP/.claude/state/handoff-qa-111.json" <<'JSON'
{ "issue_number": 111, "verdict": "NOPE_NOT_A_VALID_VERDICT" }
JSON
# Backdate it well before any agent we simulate.
touch -t 202001010000 "$TMP/.claude/state/handoff-qa-111.json"

run_hook() { # $1 = transcript path
  printf '{"agent_type":"qa-tester","agent_id":"a1","transcript_path":"%s"}' "$1" \
    | CLAUDE_PROJECT_DIR="$TMP" bash "$TMP/.claude/hooks/gate-check.sh" 2>&1
  return $?
}

echo "gate-check.sh — #910"

# 1. THE BUG: agent writes nothing, a stale invalid neighbour exists.
#    Old behaviour: validates the neighbour and blocks. New: ignores it.
TRANSCRIPT="$TMP/transcript-a.jsonl"
: > "$TRANSCRIPT"
out="$(run_hook "$TRANSCRIPT")"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "stale handoff from another issue does not block a dispatch that wrote none"
else
  fail "stale handoff from another issue does not block" "exit $rc, output: $out"
fi

if grep -q "ignored 1 older" "$TMP/.claude/hooks/log/$(date +%F).log" 2>/dev/null; then
  pass "log distinguishes 'ignored a neighbour' from 'wrote nothing at all'"
else
  fail "log distinguishes ignored-neighbour" "expected 'ignored 1 older' in log"
fi

# 2. A handoff the agent DID write, and which is invalid, must still block.
TRANSCRIPT2="$TMP/transcript-b.jsonl"
: > "$TRANSCRIPT2"
sleep 1
cat > "$TMP/.claude/state/handoff-qa-222.json" <<'JSON'
{ "issue_number": 222, "verdict": "NOPE_NOT_A_VALID_VERDICT" }
JSON
out="$(run_hook "$TRANSCRIPT2")"; rc=$?
if [ "$rc" -ne 0 ]; then
  pass "an invalid handoff written during this run still blocks"
else
  fail "invalid handoff written during this run still blocks" "exit 0, output: $out"
fi

# The hook logs the basename it acted on; that is what identifies which file was
# gated, independent of how far the validator got.
LOGFILE="$TMP/.claude/hooks/log/$(date +%F).log"
if grep -q "REJECTED (handoff-qa-222.json)" "$LOGFILE" 2>/dev/null; then
  pass "the hook gated the current run's file, not the neighbour"
elif grep -q "REJECTED (handoff-qa-111.json)" "$LOGFILE" 2>/dev/null; then
  fail "hook gated the right file" "it gated 111, the stale neighbour — the #910 bug"
else
  fail "hook gated the right file" "no REJECTED line found in $LOGFILE"
fi

echo
if [ "$FAILURES" -gt 0 ]; then echo "$FAILURES FAILED"; exit 1; fi
echo "all passed"
