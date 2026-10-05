#!/usr/bin/env bash
#
# trust-dev-cert.sh — make the iOS Simulator trust the .NET HTTPS dev cert.
#
# WHY THIS EXISTS
# ---------------
# During development, the mobile app talks to https://localhost:5001 where the
# backend runs with a self-signed .NET developer certificate. iOS Simulator
# does not trust this cert by default, so HTTPS connections fail with
# `net::ERR_FAILED` before any HTTP status code is received.
#
# This script adds the current .NET dev cert to the simulator's keychain trust
# store so connections succeed. It is idempotent and best-effort: it never
# fails if no simulator is booted (which is common during initial setup).
#
# The trust store is per-simulator and is wiped when the simulator is erased,
# freshly created, or when the dev cert is regenerated. Re-run this script in
# those cases.
#
# Usage
# -----
# bash mobile/scripts/trust-dev-cert.sh

set -uo pipefail

# --- guard: macOS only (simctl doesn't exist elsewhere) ----------------------
if ! command -v xcrun >/dev/null 2>&1; then
  echo "trust-dev-cert: xcrun not found (not macOS?) — skipping."
  exit 0
fi

# --- find booted simulators --------------------------------------------------
BOOTED_UDIDS=$(xcrun simctl list devices booted 2>/dev/null \
  | grep -oE '[0-9A-Fa-f-]{36}' || true)

if [ -z "$BOOTED_UDIDS" ]; then
  echo "trust-dev-cert: no booted simulator — skipping (boot one, then rerun 'bash mobile/scripts/trust-dev-cert.sh')."
  exit 0
fi

# --- export the current .NET dev cert to a PEM -------------------------------
CERT_PEM="$(mktemp -t localhost-dev-cert).pem"
trap 'rm -f "$CERT_PEM"' EXIT

# `dotnet dev-certs https --export-path` prints a benign EventSource error on
# some SDKs but still writes the file; we verify the file instead of the exit
# code. --format PEM + --no-password yields a plain cert simctl can ingest.
dotnet dev-certs https --export-path "$CERT_PEM" --format PEM --no-password >/dev/null 2>&1 || true

if [ ! -s "$CERT_PEM" ]; then
  echo "trust-dev-cert: failed to export the .NET dev cert (is the .NET SDK installed and the cert created?). Run 'dotnet dev-certs https --trust' and retry." >&2
  exit 0
fi

# --- add the cert as a trusted root to each booted simulator -----------------
for UDID in $BOOTED_UDIDS; do
  if xcrun simctl keychain "$UDID" add-root-cert "$CERT_PEM" 2>/dev/null; then
    echo "trust-dev-cert: trusted .NET dev cert on simulator $UDID."
  else
    echo "trust-dev-cert: could not add cert to simulator $UDID (continuing)." >&2
  fi
done

echo "trust-dev-cert: done. Fully quit & relaunch the app for the new trust to take effect."
