#!/usr/bin/env bash
# UserPromptSubmit hook: at the start of each Claude turn, check whether
# the background tsc processes kicked off by `typecheck-on-stop.sh` have
# finished. If they have and produced errors, surface them to stderr so
# Claude sees them in the new turn's context.
#
# If a typecheck is still running (rare: user started a new turn within
# ~15s of the previous Stop), report "still running" as a lightweight
# notice and leave the state files in place — the NEXT UserPromptSubmit
# will pick them up.
#
# Always exits 0 — never blocks the user's prompt.

set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="$project_dir/.claude/.typecheck-state"

LOG_DIR="$project_dir/.claude/hooks/log"
mkdir -p "$LOG_DIR"
HOOK_LOG="$LOG_DIR/$(date +%F).log"

# Nothing to do if no state at all.
if [[ ! -d "$STATE_DIR" ]]; then exit 0; fi

report_pkg() {
    local pkg="$1"
    local label="$2"  # human-friendly, e.g. "/web"
    local pid_file="$STATE_DIR/$pkg.pid"
    local done_file="$STATE_DIR/$pkg.done"
    local log_file="$STATE_DIR/$pkg.log"
    local started_file="$STATE_DIR/$pkg.started"

    # Nothing was spawned.
    if [[ ! -f "$pid_file" ]] && [[ ! -f "$started_file" ]]; then
        return 0
    fi

    # Still running?
    if [[ -f "$pid_file" ]] && [[ ! -f "$done_file" ]]; then
        local pid
        pid="$(cat "$pid_file" 2>/dev/null || true)"
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            local started_at elapsed now
            started_at="$(cat "$started_file" 2>/dev/null || echo 0)"
            now="$(date +%s)"
            elapsed=$(( now - started_at ))
            echo "[typecheck] $label — background tsc still running (~${elapsed}s elapsed). Results will surface next turn." >&2
            return 0
        fi
        # PID is gone but no .done file — crashed or was killed. Clean up.
        rm -f "$pid_file" "$started_file" "$log_file"
        return 0
    fi

    # Done file exists → background tsc finished.
    if [[ -f "$done_file" ]]; then
        local exit_code
        exit_code="$(cat "$done_file" 2>/dev/null || echo "?")"

        if [[ -s "$log_file" ]] && grep -qE 'error TS[0-9]+' "$log_file"; then
            {
                echo "[typecheck] $label — background tsc finished with errors (exit=$exit_code, top 30 lines):"
                head -n 30 "$log_file"
                echo "[typecheck] Fix before declaring the task done — see Working Principles §2."
            } >&2
            printf '[%s] typecheck-on-submit: %s ERRORS exit=%s\n' \
              "$(date -Iseconds)" "$label" "$exit_code" >> "$HOOK_LOG"
        else
            printf '[%s] typecheck-on-submit: %s clean exit=%s\n' \
              "$(date -Iseconds)" "$label" "$exit_code" >> "$HOOK_LOG"
        fi
        # Whether it found errors or not, clean up so we don't repeat.
        rm -f "$done_file" "$pid_file" "$started_file" "$log_file"
    fi
}

report_pkg "web" "/web"
report_pkg "mobile" "/mobile"

exit 0
