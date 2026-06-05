#!/usr/bin/env bash
# Fetch a QA refresh token from the compose harness by logging in as one of the
# seeded fixture users. Prints the token to stdout.
#
# Usage:
#   mobile/scripts/qa-fetch-refresh-token.sh [client|trainer|nutritionist] [--encode|--deeplink]
#
# Default role: client. Default output: the RAW refresh token.
#
# Output modes:
#   (default)    Raw refresh token — for web localStorage injection / Bearer use.
#   --encode     URL-encoded refresh token — safe as a query-string parameter.
#   --deeplink   Full ready-to-open URL: fitnessplatform://e2e-auth?token=<url-encoded>
#                — pipe straight into `xcrun simctl openurl <udid> "$(…)"`.
#
# WHY --encode/--deeplink exist: refresh tokens are standard base64 and contain
# `+`, `/`, `=`. Passed RAW in a `fitnessplatform://e2e-auth?token=…` deep link,
# expo-linking's Linking.parse turns `+`→space and mangles `/`/`=`, so the app's
# POST /auth/refresh receives a corrupted token and silently logs out. The iOS
# dev-client auth bypass MUST use --encode or --deeplink.
#
# HARNESS URL: resolved from the current branch's stack via `scripts/test-env
# ports` (JSON .api_url). The harness host port is EPHEMERAL — the old fixed
# `:5101` mapping is gone (see docs/testing/e2e-fixtures.md).
#
# Prerequisites:
#   - .env.test at the repo root with QA_SEED_PASSWORD set.
#   - Compose harness running: `scripts/test-env up [<branch>]` (or `npm run e2e:up`).
#   - jq installed.
#
# See docs/testing/e2e-fixtures.md for fixture details.

set -euo pipefail

# ── Parse args (role + optional output-mode flag, any order) ─────────────────
role="client"
output_mode="raw"   # raw | encode | deeplink

for arg in "$@"; do
  case "$arg" in
    client|trainer|nutritionist) role="$arg" ;;
    --encode)   output_mode="encode" ;;
    --deeplink) output_mode="deeplink" ;;
    *)
      echo "Usage: $0 [client|trainer|nutritionist] [--encode|--deeplink]" >&2
      exit 1
      ;;
  esac
done

# ── Resolve email for the requested role ───────────────────────────────────
case "$role" in
  client)       email="qa.client@fitnessplatform.test" ;;
  trainer)      email="qa.trainer@fitnessplatform.test" ;;
  nutritionist) email="qa.nutri@fitnessplatform.test" ;;
esac

# ── jq is required (parse login response + URL-encode) ──────────────────────
if ! command -v jq &>/dev/null; then
  echo "error: jq is not installed — install it to parse the login response" >&2
  exit 1
fi

# ── Load QA_SEED_PASSWORD from .env.test ───────────────────────────────────
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
env_file="$repo_root/.env.test"

if [[ ! -f "$env_file" ]]; then
  echo "error: .env.test not found at $env_file" >&2
  echo "       Copy .env.test.example to .env.test and set QA_SEED_PASSWORD." >&2
  echo "       See docs/testing/e2e-fixtures.md for details." >&2
  exit 1
fi

# Source only the QA_SEED_PASSWORD line to avoid polluting the environment
# with other variables that may have shell-unsafe values.
QA_SEED_PASSWORD="$(grep -E '^QA_SEED_PASSWORD=' "$env_file" | head -1 | cut -d= -f2-)"

if [[ -z "$QA_SEED_PASSWORD" ]]; then
  echo "error: QA_SEED_PASSWORD is not set in $env_file" >&2
  echo "       See docs/testing/e2e-fixtures.md for details." >&2
  exit 1
fi

# ── Resolve the harness base URL from the current branch's stack ────────────
# The host port is ephemeral; read it from the test-env JSON envelope.
harness_url="$(
  "$repo_root/scripts/test-env" ports 2>/dev/null | jq -r '.api_url // empty'
)" || harness_url=""

if [[ -z "$harness_url" ]]; then
  echo "error: no compose stack found for this branch — run \`scripts/test-env up\` first." >&2
  echo "       (The harness host port is ephemeral; the old fixed :5101 mapping is gone.)" >&2
  exit 1
fi

# ── POST to /auth/login on the compose harness ─────────────────────────────
# Capture body and HTTP status code separately to avoid BSD head(1) incompatibility.
# BSD head on macOS rejects negative line counts (head -n -1 → "illegal line count").
# Using -o to write the body to a temp file and -w to capture only the status code
# on stdout avoids any line-trimming and keeps stderr clean from response data.
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

status_code="$(
  curl -k -sS \
    -o "$body_file" \
    -w '%{http_code}' \
    -X POST "$harness_url/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$QA_SEED_PASSWORD\"}"
)" || {
  rm -f "$body_file"
  echo "error: harness unreachable at $harness_url — run \`scripts/test-env up\`" >&2
  exit 1
}

body="$(cat "$body_file")"

# ── Handle HTTP error codes ────────────────────────────────────────────────
case "$status_code" in
  200)
    : # success — handled below
    ;;
  401)
    echo "error: auth failed (HTTP 401) — check QA_SEED_PASSWORD against \`.env.test.example\`" >&2
    exit 1
    ;;
  404)
    echo "error: /auth/login not found at $harness_url (HTTP 404) — is the harness running? (\`scripts/test-env up\`)" >&2
    exit 1
    ;;
  5*)
    excerpt="${body:0:200}"
    echo "error: harness 5xx: $status_code — body excerpt: $excerpt" >&2
    exit 1
    ;;
  *)
    echo "error: unexpected HTTP $status_code from harness" >&2
    exit 1
    ;;
esac

# ── Extract refreshToken via jq ────────────────────────────────────────────
refresh_token="$(printf '%s' "$body" | jq -r '.refreshToken // empty')"

if [[ -z "$refresh_token" ]]; then
  echo "error: login succeeded but response missing refreshToken — schema mismatch?" >&2
  exit 1
fi

# ── Emit per output mode (stdout only — never to a log file) ────────────────
case "$output_mode" in
  raw)
    printf '%s\n' "$refresh_token"
    ;;
  encode)
    printf '%s' "$refresh_token" | jq -sRr @uri
    ;;
  deeplink)
    encoded="$(printf '%s' "$refresh_token" | jq -sRr @uri)"
    printf 'fitnessplatform://e2e-auth?token=%s\n' "$encoded"
    ;;
esac
