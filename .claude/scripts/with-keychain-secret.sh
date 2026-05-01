#!/usr/bin/env bash
# with-keychain-secret.sh — fetch a secret from macOS Keychain and exec a
# command with it in the environment. Used to pass tokens to MCP servers
# without storing them in plaintext in ~/.claude/settings.json.
#
# Usage:
#   with-keychain-secret.sh <KEYCHAIN_ITEM_NAME> <ENV_VAR_NAME> -- <cmd> [args...]
#
# Example (in settings.json):
#   "github": {
#     "command": "/Users/jan/.claude/scripts/with-keychain-secret.sh",
#     "args": [
#       "Claude Code GitHub PAT",
#       "GITHUB_PERSONAL_ACCESS_TOKEN",
#       "--",
#       "npx", "-y", "@modelcontextprotocol/server-github"
#     ]
#   }
#
# Add the secret first (interactive — it'll prompt you to paste the token):
#   security add-generic-password -a "$USER" -s "Claude Code GitHub PAT" -w
#
# Verify:
#   security find-generic-password -a "$USER" -s "Claude Code GitHub PAT" -w

set -euo pipefail

if [ "$#" -lt 4 ]; then
    echo "usage: $0 <keychain-item> <env-var-name> -- <command> [args...]" >&2
    exit 64
fi

ITEM="$1"
VAR="$2"
SEPARATOR="$3"
shift 3

if [ "$SEPARATOR" != "--" ]; then
    echo "error: third argument must be '--' (got: $SEPARATOR)" >&2
    exit 64
fi

# Fetch the secret. -w prints just the password to stdout.
# -a $USER selects the account; -s "<name>" selects the service (the item label).
SECRET="$(security find-generic-password -a "$USER" -s "$ITEM" -w 2>/dev/null || true)"

if [ -z "$SECRET" ]; then
    echo "error: keychain item '$ITEM' not found for user '$USER'." >&2
    echo "       Add it with:" >&2
    echo "         security add-generic-password -a \"\$USER\" -s \"$ITEM\" -w" >&2
    exit 1
fi

# Export and exec. `exec` so we replace this process — signals propagate cleanly.
export "$VAR=$SECRET"
exec "$@"
