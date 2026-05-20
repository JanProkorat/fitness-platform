#!/usr/bin/env bash
# agent-bash-allowlist.sh — PreToolUse[Bash] hook.
#
# Per-agent bash allowlist dispatcher. Each agent gets a curated list of
# command prefixes; anything outside its toolchain gets denied with a
# clear message. Defence-in-depth on top of:
#   - the global deny list in settings.json (force-push, secrets, etc.)
#   - deny-subagent-merge.sh (gh pr merge, force-push from subagents)
#   - the agent's frontmatter `tools:` list (limits the tool surface)
#
# DECISION RULES:
#   - Main thread (no agent_type) → pass through; orchestrator's bash is
#     governed by settings.json's allow/deny/ask lists.
#   - Recognised agent type → cmd must match an allowlist regex for that
#     agent. No match = deny with a guidance message.
#   - Unknown agent type (Explore, general-purpose, etc.) → pass through.
#     Those agents are short-lived scouts; their bash use is read-only by
#     convention and the global deny list still applies.
#
# EXIT CODE: always 0 — decision via stdout JSON.

set -euo pipefail

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/log"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%F).log"

INPUT="$(cat)"

CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
[ -z "$CMD" ] && exit 0

AGENT_TYPE="$(printf '%s' "$INPUT" | jq -r '.agent_type // .subagent_type // empty')"

# Main thread → no per-agent allowlist applies. Settings.json governs.
[ -z "$AGENT_TYPE" ] && exit 0

# The first token of the command is what we usually match against.
# Use Python for reliable parsing of leading whitespace and pipes.
FIRST_WORD="$(printf '%s' "$CMD" | awk '{print $1}')"

deny() {
    local reason="$1"
    printf '[%s] agent-bash-allowlist: %s blocked: %q (reason: %s)\n' \
        "$(date -Iseconds)" "$AGENT_TYPE" "$CMD" "$reason" >> "$LOG"
    jq -n --arg reason "$reason" \
        '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
    exit 0
}

# Reusable allowlist regexes.
# GIT_READ / GIT_WRITE match both the bare form (`git status`) and the
# worktree-targeted form (`git -C <path> status`, `git --git-dir=<path> status`,
# `git --work-tree=<path> status`) so that sub-agents can inspect and modify
# state inside `.worktrees/<issue>/` without needing `cd` (which is itself
# blocked by the FS_READ regex below).
GIT_READ='^git( -C \S+| --git-dir=\S+| --work-tree=\S+)? (status|diff|log|show|branch|rev-parse|ls-files|fetch|remote)( |$)'
GIT_WRITE='^git( -C \S+| --git-dir=\S+| --work-tree=\S+)? (add|commit|checkout|switch|stash|restore|reset(?! --hard)|rm|mv|push|pull|rebase|merge|worktree|fetch)( |$)'
FS_READ='^(find|grep|cat|head|tail|less|more|ls|wc|awk|sed( -n)?|jq|xargs|sort|uniq|cut|tr|tee|file|stat|du|tree|which|type|env)( |$)'
GH_READ='^gh (issue view|issue list|pr view|pr list|pr checks|pr diff|api( |$)|run view|run list|workflow view|label list|repo view)( |$)'

case "$AGENT_TYPE" in
    backend-dotnet)
        ALLOW_REGEX="^(dotnet )|${GIT_READ}|${GIT_WRITE}|${FS_READ}|${GH_READ}|^(npm( ls| run| ci)|npx --no-install)|^pkill( -| $)|^docker (compose|ps|logs)|^bash |^python3 "
        DENY_HINT="backend-dotnet may run dotnet/git/gh/find/grep/etc. but not npm install / expo / xcrun / direct merges. If you need a different tool, return to orchestrator."
        ;;
    web-react)
        ALLOW_REGEX="^(npm |npx )|${GIT_READ}|${GIT_WRITE}|${FS_READ}|${GH_READ}|^node |^bash |^python3 "
        DENY_HINT="web-react may run npm/npx/node/git/gh/find/grep/etc. but not dotnet/expo/xcrun/direct merges."
        ;;
    mobile-expo)
        ALLOW_REGEX="^(npm |npx |expo )|${GIT_READ}|${GIT_WRITE}|${FS_READ}|${GH_READ}|^xcrun |^osascript|^node |^bash |^python3 "
        DENY_HINT="mobile-expo may run expo/npm/npx/xcrun/osascript/git/gh/etc. but not dotnet."
        ;;
    qa-tester)
        # Read-only at the source-tree level — but qa-tester runs builds, tests, dev servers.
        # Allow everything dev/web/mobile agents allow EXCEPT git write ops and gh write ops.
        ALLOW_REGEX="^(dotnet (test|build|run))|^(npm (run|ci|ls)|npx (--no-install|expo|tsc|playwright))|^(node )|^(xcrun |osascript)|${GIT_READ}|${FS_READ}|${GH_READ}|^pkill( -| $)|^docker (compose|ps|logs)|^bash |^python3 |^curl |^open |^brew "
        DENY_HINT="qa-tester is read-only at source level. Allowed: dotnet test/build/run, npm/npx, expo, xcrun, git read-only, gh read-only. Forbidden: git commit/push, gh pr create/merge, code edits."
        ;;
    pr-reviewer)
        ALLOW_REGEX="^(gh pr |gh issue |gh api|gh run|gh label)|${GIT_READ}|${FS_READ}|^bash |^python3 "
        DENY_HINT="pr-reviewer runs gh + git read-only + grep/find. Code-edit tools and dotnet/npm builds are not yours — those are dev-agent responsibilities."
        ;;
    design-reviewer)
        # Read-only — checklist walker against issue + dispatch brief.
        ALLOW_REGEX="^(gh issue|gh pr view|gh api)|${GIT_READ}|${FS_READ}|^bash |^python3 "
        DENY_HINT="design-reviewer is pure read-only review. Allowed: gh issue view, git read-only, grep/find. No builds, no edits, no PR ops."
        ;;
    github-issues)
        ALLOW_REGEX="^(gh issue|gh label|gh api|gh repo|gh search)|${GIT_READ}|${FS_READ}|^bash |^python3 "
        DENY_HINT="github-issues runs gh + git read-only. No code edits, no pushes, no PR creation."
        ;;
    *)
        # Unknown agent type — pass through (Explore, general-purpose, etc.)
        exit 0
        ;;
esac

# Use Python for proper regex matching (bash =~ doesn't handle the
# alternation patterns above reliably across shells).
if printf '%s' "$CMD" | python3 -c "import re,sys; cmd=sys.stdin.read(); pat=$(printf '%s' "$ALLOW_REGEX" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'); sys.exit(0 if re.match(pat, cmd) else 1)"; then
    exit 0
fi

deny "$AGENT_TYPE not allowed to run '$FIRST_WORD'. $DENY_HINT"
