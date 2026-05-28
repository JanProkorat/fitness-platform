#!/usr/bin/env bash
#
# Runs a named Playwright flow inside the qa-playwright container.
#
# Usage:
#   /work/named-flow-runner.sh <flow-name>
#
# Reads /work/flows.json (name -> {spec, description}) and runs:
#   npx playwright test <spec> --reporter=line
#
# Exit code matches Playwright's. Output streams to stdout/stderr so the
# orchestrator + CI workflow can capture per-flow logs.

set -euo pipefail

FLOWS_JSON="/work/flows.json"
WEB_DIR="/work/web"
FLOW="${1:-}"

list_flows() {
  if [[ -f "$FLOWS_JSON" ]]; then
    jq -r 'to_entries[] | "  \(.key)  —  \(.value.description // "")"' "$FLOWS_JSON" 2>/dev/null \
      || echo "  (flows.json present but unreadable)"
  else
    echo "  (flows.json not yet populated — lands in Phase 4)"
  fi
}

if [[ -z "$FLOW" ]] || [[ "$FLOW" == "--help" ]] || [[ "$FLOW" == "-h" ]]; then
  cat <<USAGE
Usage: named-flow-runner.sh <flow-name>

Known flows:
$(list_flows)
USAGE
  # When invoked with --help, exit 0. With no arg, exit 1 (caller error).
  [[ "$FLOW" == "--help" ]] || [[ "$FLOW" == "-h" ]] && exit 0
  exit 1
fi

if [[ ! -f "$FLOWS_JSON" ]]; then
  printf '{"ok":false,"reason":"flows.json not present","flow":"%s"}\n' "$FLOW" >&2
  exit 1
fi

SPEC=$(jq -r --arg flow "$FLOW" '.[$flow].spec // ""' "$FLOWS_JSON")
if [[ -z "$SPEC" ]]; then
  KNOWN=$(jq -r 'keys | join(", ")' "$FLOWS_JSON")
  printf '{"ok":false,"reason":"unknown flow","flow":"%s","known":"%s"}\n' "$FLOW" "$KNOWN" >&2
  exit 1
fi

cd "$WEB_DIR"
exec npx playwright test "$SPEC" --reporter=line
