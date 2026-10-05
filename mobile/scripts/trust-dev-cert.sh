#!/usr/bin/env bash
#
# trust-dev-cert.sh — make the iOS Simulator trust the .NET HTTPS dev cert.
#
# WHY THIS EXISTS
# ---------------
# In __DEV__ the mobile app talks to the backend over https://localhost:5001
# (see src/api/client.ts — HTTP is banned because iOS strips the Authorization
# header across an HTTP->HTTPS redirect). That endpoint is served with the
# self-signed .NET developer certificate.
#
# `localhost` is a loopback address, so iOS exempts it from App Transport
# Security entirely — which means NO app.json / Info.plist key is involved.
# What DOES gate the connection is TLS certificate trust: iOS evaluates the
# server cert against the simulator's keychain trust store, and a self-signed
# cert that isn't in that store fails the handshake. React Native surfaces that
# as `net::ERR_FAILED` on the request (e.g. the /auth/login POST), with no HTTP
# status because the response never arrives.
#
# The trust store is PER-SIMULATOR and is wiped whenever a simulator is erased,
# freshly created, or when the dev cert is regenerated. This script re-adds the
# current dev cert to every booted simulator. It is idempotent and best-effort:
# it never fails the build if no simulator is booted (that's the common case
# during `expo start`, where you boot/pick the sim afterwards).
#
# Run manually:   npm run ios:trust-cert
# Runs automatically before `npm start` via the `prestart` hook.

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
  echo "trust-dev-cert: no booted simulator — skipping (boot one, then rerun 'npm run ios:trust-cert')."
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
