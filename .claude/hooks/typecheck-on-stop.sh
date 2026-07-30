#!/usr/bin/env bash
# Stop hook: after Claude finishes a turn, spawn TypeScript typechecks in
# the BACKGROUND for any package whose .ts/.tsx files were modified during
# the turn. Returns immediately (<1s) so Claude's Stop event is not blocked.
#
# The paired hook `typecheck-on-submit.sh` (UserPromptSubmit) reads the
# results at the start of the next turn and surfaces any errors to Claude's
# context via stderr.
#
# Why this design:
#   tsc -b --noEmit in /web runs ~10s warm; tsc --noEmit in /mobile runs
#   ~15-17s warm. Running synchronously on Stop would add 10-17s of latency
#   at the end of every turn that touches TS. Running in the background
#   makes the latency invisible — errors arrive on the next Claude turn.
#
# State:
#   - $STATE_DIR/web.log, $STATE_DIR/mobile.log   — captured tsc output
#   - $STATE_DIR/web.pid, $STATE_DIR/mobile.pid   — background PIDs
#   - $STATE_DIR/web.done, $STATE_DIR/mobile.done — created on completion
#                                                    (contains exit code)
#
# Escape hatch: set FITNESS_PLATFORM_WEB_ONLY=1 to skip mobile typechecks.

set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if ! command -v git >/dev/null 2>&1; then exit 0; fi
cd "$project_dir" 2>/dev/null || exit 0
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then exit 0; fi

LOG_DIR="$project_dir/.claude/hooks/log"
mkdir -p "$LOG_DIR"
HOOK_LOG="$LOG_DIR/$(date +%F).log"

STATE_DIR="$project_dir/.claude/.typecheck-state"
mkdir -p "$STATE_DIR"

# macOS does NOT ship `setsid` — it is part of util-linux. Piping the spawn
# through it on a Mac fails silently (stderr is discarded here), so the
# background tsc never started and `typecheck-on-submit.sh` had nothing to
# report: 649 of 1650 invocations detected changed .ts files between
# 2026-04-30 and 2026-07-27 and produced zero results. Use setsid where it
# exists (Linux/CI); otherwise `nohup` + `disown` is enough to survive this
# hook shell exiting.
if command -v setsid >/dev/null 2>&1; then
    SPAWN=(setsid nohup)
else
    SPAWN=(nohup)
fi

# Detect modified TS files per package.
status="$(git status --porcelain 2>/dev/null || true)"
web_changed=0
mobile_changed=0

while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    path="${line:3}"
    if [[ "$path" == *" -> "* ]]; then
        path="${path##* -> }"
    fi
    case "$path" in
        web/*)
            [[ "$path" == *.ts || "$path" == *.tsx ]] && web_changed=1
            ;;
        mobile/*)
            [[ "$path" == *.ts || "$path" == *.tsx ]] && mobile_changed=1
            ;;
    esac
done <<< "$status"

if [[ "${FITNESS_PLATFORM_WEB_ONLY:-0}" == "1" ]]; then
    mobile_changed=0
fi

# Reap any stale previous runs whose PIDs are no longer alive. If a PID
# IS still alive, kill it — Claude has moved on and we don't want stale
# runs racing with our new ones.
reap_previous() {
    local pkg="$1"
    local pid_file="$STATE_DIR/$pkg.pid"
    if [[ -f "$pid_file" ]]; then
        local old_pid
        old_pid="$(cat "$pid_file" 2>/dev/null || true)"
        if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
            # Still running — kill the process group to be sure children go too.
            kill -TERM "-$old_pid" 2>/dev/null || kill -TERM "$old_pid" 2>/dev/null || true
        fi
        rm -f "$pid_file"
    fi
    rm -f "$STATE_DIR/$pkg.done" "$STATE_DIR/$pkg.log" "$STATE_DIR/$pkg.started"
}

spawn_typecheck() {
    local pkg="$1"
    local cmd="$2"
    local pkg_dir="$project_dir/$pkg"

    if [[ ! -d "$pkg_dir/node_modules" ]]; then
        return
    fi

    reap_previous "$pkg"

    local log_file="$STATE_DIR/$pkg.log"
    local pid_file="$STATE_DIR/$pkg.pid"
    local done_file="$STATE_DIR/$pkg.done"
    local started_file="$STATE_DIR/$pkg.started"

    date +%s > "$started_file"

    # $SPAWN: `setsid nohup` where setsid exists, else plain `nohup` (macOS).
    # </dev/null: detach stdin so the child doesn't block on tty.
    # >log 2>&1: capture all output.
    # trailing '&': background.
    # The inner bash runs the command then writes the exit code to .done
    #   atomically (via a temp file + mv).
    # The inner shell records its OWN pid ($$) rather than us recording $!:
    # where setsid IS present it forks, making $! a short-lived wrapper, so
    # `kill -0 $!` reports a live typecheck as dead — and the submit side then
    # deleted the very log it was about to read.
    (
        "${SPAWN[@]}" bash -c "
            printf '%s' \"\$\$\" > '$pid_file'
            cd '$pkg_dir' && $cmd > '$log_file' 2>&1
            code=\$?
            printf '%s' \"\$code\" > '$done_file.tmp' && mv '$done_file.tmp' '$done_file'
        " </dev/null >/dev/null 2>&1 &
        disown || true
    )
}

if [[ "$web_changed" == "1" ]]; then
    spawn_typecheck "web" "npx --no-install tsc -b --noEmit"
fi
if [[ "$mobile_changed" == "1" ]]; then
    spawn_typecheck "mobile" "npx --no-install tsc --noEmit"
fi

printf '[%s] typecheck-on-stop: web=%s mobile=%s\n' \
  "$(date -Iseconds)" "$web_changed" "$mobile_changed" >> "$HOOK_LOG"

exit 0
