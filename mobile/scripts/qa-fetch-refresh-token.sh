#!/usr/bin/env bash
# Fetch a QA refresh token from the compose harness (:5101) by logging in as one
# of the seeded fixture users.  Prints the token to stdout so callers can pipe
# it directly into `xcrun simctl openurl`.
#
# Usage:
#   mobile/scripts/qa-fetch-refresh-token.sh [client|trainer|nutritionist]
#
# Default role: client
#
# Prerequisites:
#   - .env.test at the repo root with QA_SEED_PASSWORD set.
#   - Compose harness running: npm run e2e:up
#   - jq installed.
#
# See docs/testing/e2e-fixtures.md for fixture details.

set -euo pipefail

role="${1:-client}"

# ── Resolve email for the requested role ───────────────────────────────────
case "$role" in
  client)       email="qa.client@fitnessplatform.test" ;;
  trainer)      email="qa.trainer@fitnessplatform.test" ;;
  nutritionist) email="qa.nutri@fitnessplatform.test" ;;
  *)
    echo "Usage: $0 [client|trainer|nutritionist]" >&2
    exit 1
    ;;
esac

# ── Load QA_SEED_PASSWORD from .env.test ───────────────────────────────────
repo_root="$(dirname "$0")/../.."
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

# ── POST to /auth/login on the compose harness ─────────────────────────────
harness_url="https://localhost:5101"

# Capture body + HTTP status code in one curl call.
# The status code is appended after a newline separator.
response="$(
  curl -k -sS \
    -w '\n%{http_code}' \
    -X POST "$harness_url/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$QA_SEED_PASSWORD\"}" \
  2>&1
)" || {
  echo "error: harness unreachable on :5101 — run \`npm run e2e:up\`" >&2
  exit 1
}

# Split body and status code (last line).
status_code="$(printf '%s' "$response" | tail -1)"
body="$(printf '%s' "$response" | head -n -1)"

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
    echo "error: /auth/login not found on harness :5101 (HTTP 404) — is the harness running? (\`npm run e2e:up\`)" >&2
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
if ! command -v jq &>/dev/null; then
  echo "error: jq is not installed — install it to parse the login response" >&2
  exit 1
fi

refresh_token="$(printf '%s' "$body" | jq -r '.refreshToken // empty')"

if [[ -z "$refresh_token" ]]; then
  echo "error: login succeeded but response missing refreshToken — schema mismatch?" >&2
  exit 1
fi

# Token to stdout only — never to a log file.
printf '%s\n' "$refresh_token"
