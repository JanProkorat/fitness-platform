#!/usr/bin/env bash
# split-compound-commands.sh — PreToolUse hook for the Bash tool.
# Intercepts compound commands and asks Claude to run each part individually,
# so every command goes through permission validation separately.
#
# SPLITS ON:   && and ; at the top level (not inside quotes/subshells)
# LEAVES:      | pipes and || conditionals intact (single logical operations)
# SKIPS:       for/while/if/case constructs (their ; and && are structural)
#
# EXIT CODES (Claude Code hook contract):
#   0 = allow (simple command) or deny (compound — communicated via JSON stdout)

set -euo pipefail

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/log"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%F).log"

INPUT="$(cat)"
CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
[ -z "$CMD" ] && exit 0

export HOOK_CMD="$CMD"

PARTS=$(python3 << 'PYEOF'
import os, sys

cmd = os.environ.get('HOOK_CMD', '')

# Skip shell constructs — their ; and && are structural, not sequencers.
first = cmd.strip().split()[0] if cmd.strip() else ''
if first in ('for', 'while', 'until', 'if', 'case', '{'):
    sys.exit(0)

def split_top_level(cmd):
    """Split cmd on && and ; at the top level, respecting quotes and subshells."""
    parts, current, depth, i = [], [], 0, 0
    in_single = in_double = False

    while i < len(cmd):
        c = cmd[i]
        rest = cmd[i:]

        if c == "'" and not in_double:
            in_single = not in_single
            current.append(c)
        elif c == '"' and not in_single:
            in_double = not in_double
            current.append(c)
        elif not in_single and not in_double:
            if c == '\\':
                current.append(c)
                if i + 1 < len(cmd):
                    i += 1
                    current.append(cmd[i])
            elif c in '({':
                depth += 1
                current.append(c)
            elif c in ')}':
                depth -= 1
                current.append(c)
            elif depth == 0 and rest.startswith('&&') and not rest.startswith('&&='):
                if p := ''.join(current).strip():
                    parts.append(p)
                current = []
                i += 2
                continue
            elif depth == 0 and c == ';' and not rest.startswith(';;'):
                if p := ''.join(current).strip():
                    parts.append(p)
                current = []
            else:
                current.append(c)
        else:
            current.append(c)
        i += 1

    if p := ''.join(current).strip():
        parts.append(p)
    return parts

parts = split_top_level(cmd)
if len(parts) > 1:
    for p in parts:
        print(p)
PYEOF
)

if [ -n "$PARTS" ]; then
    COUNT=$(echo "$PARTS" | wc -l | tr -d ' ')
    printf '[%s] split-compound: splitting %s parts from: %q\n' \
      "$(date -Iseconds)" "$COUNT" "$CMD" >> "$LOG"

    LINES=""
    while IFS= read -r line; do
        [ -n "$line" ] && LINES="${LINES}\\n  • ${line}"
    done <<< "$PARTS"

    jq -n --arg reason "Compound command detected. Run each command individually in order:${LINES}" \
      '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
fi

exit 0
