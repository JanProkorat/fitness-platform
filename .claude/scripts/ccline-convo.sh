#!/usr/bin/env bash
# Statusline wrapper:
#   Left:  conversation tokens since session start (delta vs first-render baseline)
#   Right: 5h-block usage (time remaining + token % with bar)
#
# By default ccline reports total context fill — system prompt + tool defs +
# skill catalogue + MCP schemas + your conversation. On a project with many
# plugins that baseline alone can fill 50–60% of the 1M context window before
# you type anything, and `/clear` does not drop it (it only wipes conversation
# history, not the structural baseline).
#
# This wrapper snapshots the first-render total per session_id as the baseline
# and then reports `current − baseline` so the percentage reflects only what
# has been added since session start. See .claude/claude-tooling.md for the
# full setup notes.

# Intentional: `set -u` only, no `-e` / `-o pipefail`. The statusline must
# never crash the prompt — every command degrades gracefully via 2>/dev/null
# fallbacks. Adding -e/pipefail would convert benign python parse failures
# (transcript shape drift, ccusage missing) into a blank statusline.
set -u

BASELINE_DIR="$HOME/.claude/.statusline-baselines"
mkdir -p "$BASELINE_DIR"

# Prune baseline files older than 14 days. Tiny single-int files, but they'd
# accumulate one-per-session indefinitely without this. Best-effort.
find "$BASELINE_DIR" -type f -name '*.txt' -mtime +14 -delete 2>/dev/null || true

# Resolve python3 portably — prefer PATH, fall back to the macOS system path.
PYTHON="$(command -v python3 || echo /usr/bin/python3)"

input="$(cat)"

session_id="$(printf '%s' "$input" | "$PYTHON" -c 'import json,sys; d=json.load(sys.stdin); print(d.get("session_id",""))' 2>/dev/null)"
transcript="$(printf '%s' "$input" | "$PYTHON" -c 'import json,sys; d=json.load(sys.stdin); print(d.get("transcript_path",""))' 2>/dev/null)"

current_tokens=0
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  current_tokens="$("$PYTHON" -c '
import json, sys
total = 0
try:
    with open(sys.argv[1]) as f:
        for line in f:
            try:
                msg = json.loads(line)
                u = msg.get("usage") or msg.get("message", {}).get("usage") or {}
                total += int(u.get("input_tokens", 0)) \
                       + int(u.get("output_tokens", 0)) \
                       + int(u.get("cache_read_input_tokens", 0)) \
                       + int(u.get("cache_creation_input_tokens", 0))
            except Exception:
                pass
except Exception:
    pass
print(total)
' "$transcript" 2>/dev/null)"
  current_tokens="${current_tokens:-0}"
fi

# Baseline logic — only when we have a session_id AND a non-zero current
# total. Persisting a 0 baseline (silent python parse failure or empty
# transcript) would lock the wrapper into "delta == current" forever.
baseline=0
if [ -n "$session_id" ]; then
  baseline_file="$BASELINE_DIR/$session_id.txt"
  if [ ! -f "$baseline_file" ] && [ "$current_tokens" -gt 0 ]; then
    echo "$current_tokens" > "$baseline_file"
  fi
  baseline="$(cat "$baseline_file" 2>/dev/null || echo 0)"
fi

delta=$(( current_tokens - baseline ))
[ "$delta" -lt 0 ] && delta=0

# Default 1M cap (Opus 4.7 1M). Override with CCLINE_CAP_TOKENS env var.
cap="${CCLINE_CAP_TOKENS:-1000000}"
room=$(( cap - baseline ))
pct=0
[ "$room" -gt 0 ] && pct=$(( delta * 100 / room ))
[ "$pct" -gt 100 ] && pct=100

filled=$(( pct * 8 / 100 ))
empty=$(( 8 - filled ))
bar=""
while [ "$filled" -gt 0 ]; do bar="${bar}█"; filled=$((filled-1)); done
while [ "$empty"  -gt 0 ]; do bar="${bar} "; empty=$((empty-1));   done

if [ "$delta" -ge 1000 ]; then
  pretty="$(( delta / 1000 )).$(( (delta % 1000) / 100 ))k"
else
  pretty="$delta"
fi

left="⚡ ${pct}% [${bar}] · ${pretty} convo"

# Right side — 5h-block usage from ccusage. Optional; degrades gracefully.
#
# By default we let ccusage auto-detect the cap from usage history, which
# matches what Claude Code's `/status` reports. Hardcoding `--token-limit
# max` would force the Max20 tier cap (~6.5M tokens) regardless of the
# user's actual plan, so the percentage would diverge from /status (e.g.
# 12.6% here vs 82% in /status on a Max5 plan).
#
# Override via CCLINE_BLOCK_TOKEN_LIMIT (e.g. "max", "pro", "max5") if the
# auto-detected cap isn't what you want.
block_summary=""
if command -v ccusage >/dev/null 2>&1; then
  ccusage_args=(blocks --active --json)
  if [ -n "${CCLINE_BLOCK_TOKEN_LIMIT:-}" ]; then
    ccusage_args+=(--token-limit "$CCLINE_BLOCK_TOKEN_LIMIT")
  fi
  block_summary="$(ccusage "${ccusage_args[@]}" 2>/dev/null \
    | "$PYTHON" -c '
import json, sys, datetime
try:
    d = json.load(sys.stdin)
    b = (d.get("blocks") or [None])[0]
    if not b or not b.get("isActive"):
        sys.exit(0)
    end = datetime.datetime.fromisoformat(b["endTime"].replace("Z", "+00:00"))
    now = datetime.datetime.now(datetime.timezone.utc)
    mins = max(0, int((end - now).total_seconds() / 60))
    h, m = divmod(mins, 60)
    used = b.get("totalTokens") or 0
    tls = b.get("tokenLimitStatus") or {}
    limit = tls.get("limit") or 0
    cur_pct = (used / limit * 100) if limit else 0
    print(f"⏳ {h}h {m:02d}m · {cur_pct:.1f}%")
except Exception:
    pass
' 2>/dev/null)" || block_summary=""
fi

if [ -n "$left" ] && [ -n "$block_summary" ]; then
  printf '%s | %s\n' "$left" "$block_summary"
else
  printf '%s%s\n' "$left" "$block_summary"
fi
