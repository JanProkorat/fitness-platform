#!/usr/bin/env bash
# validate-on-write.sh — PostToolUse[Write|Edit|MultiEdit] hook.
#
# Schema-validates handoff/state JSON at the moment it is WRITTEN, instead of
# waiting for the SubagentStop gate.
#
# WHY:
#   `gate-check.sh` already validates a sub-agent's handoff — but only once,
#   when control returns to the orchestrator. A malformed handoff written in
#   step 2 of an agent's run is therefore not caught until the agent has
#   finished all its work, so the agent has to be re-dispatched to fix a
#   typo it could have corrected immediately. This hook closes that loop:
#   the agent sees the validation error on the very next turn.
#
#   gate-check.sh stays as-is — it remains the authoritative gate (it also
#   catches the "agent never wrote a handoff at all" case, which a write
#   hook by definition cannot).
#
# TARGETING:
#   Self-targeting, no path convention needed. A file is validated only if:
#     1. it is a .json file, AND
#     2. it has a top-level "$schema" field, AND
#     3. that "$schema" is a LOCAL path (not http(s)://) — which is exactly
#        the convention validate-handoff.py resolves against
#        CLAUDE_PROJECT_DIR.
#   This deliberately skips `.claude/schemas/*.json` themselves: those are
#   JSON Schema documents whose "$schema" points at json-schema.org.
#
# EXIT CODES:
#   0 — not a handoff, or valid.
#   2 — validation failed; stderr is fed back to Claude so it self-corrects.

set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

LOG_DIR="$project_dir/.claude/hooks/log"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%F).log"

INPUT="$(cat)"

command -v jq >/dev/null 2>&1 || exit 0

FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
[[ -z "$FILE_PATH" ]] && exit 0
[[ "$FILE_PATH" == *.json ]] || exit 0
[[ -f "$FILE_PATH" ]] || exit 0

# Never validate the schema definitions themselves.
case "$FILE_PATH" in
    */.claude/schemas/*) exit 0 ;;
esac

# Is this one of the orchestration files we care about by name? Used to decide
# whether unparseable JSON is worth complaining about — for an arbitrary .json
# file it isn't, for a handoff it very much is.
IS_HANDOFF_PATH=0
case "$FILE_PATH" in
    */state/handoff-*.json|*/state/ship-epic*.json) IS_HANDOFF_PATH=1 ;;
esac

# Catch invalid JSON early. A handoff that doesn't parse is the single most
# common failure and would otherwise slip past the $schema check below (jq
# can't read a field out of a file it can't parse).
if ! jq empty "$FILE_PATH" >/dev/null 2>&1; then
    if [[ "$IS_HANDOFF_PATH" == "1" ]]; then
        printf '[%s] validate-on-write: INVALID JSON (%s)\n' \
          "$(date -Iseconds)" "$(basename "$FILE_PATH")" >> "$LOG"
        {
            echo "[validate-on-write] $(basename "$FILE_PATH") is not valid JSON:"
            jq empty "$FILE_PATH" 2>&1 | head -5 || true
            echo "[validate-on-write] Fix it now — gate-check.sh will reject it at SubagentStop otherwise."
        } >&2
        exit 2
    fi
    exit 0
fi

# Must have a local $schema reference. Read it from the file on disk (the
# write has already happened — this is PostToolUse).
SCHEMA_REF="$(jq -r '.["$schema"] // empty' "$FILE_PATH" 2>/dev/null || true)"
[[ -z "$SCHEMA_REF" ]] && exit 0
case "$SCHEMA_REF" in
    http://*|https://*) exit 0 ;;
esac

# Validate. Capture stderr so we can hand the diagnostic to Claude verbatim.
ERR_FILE="$(mktemp -t validate-on-write.XXXXXX)"
if python3 "$project_dir/.claude/hooks/validate-handoff.py" "$FILE_PATH" \
      1>/dev/null 2>"$ERR_FILE"; then
    printf '[%s] validate-on-write: OK (%s)\n' \
      "$(date -Iseconds)" "$(basename "$FILE_PATH")" >> "$LOG"
    rm -f "$ERR_FILE"
    exit 0
fi

printf '[%s] validate-on-write: REJECTED (%s)\n' \
  "$(date -Iseconds)" "$(basename "$FILE_PATH")" >> "$LOG"

{
    echo "[validate-on-write] $(basename "$FILE_PATH") does not conform to its declared schema ($SCHEMA_REF):"
    cat "$ERR_FILE"
    echo "[validate-on-write] Fix the handoff now — gate-check.sh will reject it at SubagentStop otherwise."
} >&2

rm -f "$ERR_FILE"
exit 2
