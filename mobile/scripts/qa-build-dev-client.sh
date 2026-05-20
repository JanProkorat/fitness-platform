#!/usr/bin/env bash
# Build a fresh Expo dev-client .app for the iOS Simulator and cache it by
# mobile-tree SHA. qa-tester invokes this whenever it needs to drive the
# native app via XcodeBuildMCP; humans can run it directly to refresh the
# cache. Cold builds take 5–8 min; cache hits return in <1s.
#
# Output: a single absolute path on stdout pointing at the cached .app bundle.
#
# WHY the guards below exist (cold-build race + validation):
#
# 1. pod install guard: if Pods/Manifest.lock diverges from Podfile.lock (e.g.
#    after a dependency bump or a fresh checkout), xcodebuild fails to resolve
#    target dependencies before Expo/Nitro emit their modulemaps, producing 33+
#    "module map file not found" errors. Running pod install first resolves all
#    CocoaPods targets so modulemaps emit in the correct order.
#
# 2. Drop -quiet: -quiet suppresses ALL xcodebuild output including errors, so
#    a failed build appears to succeed silently. Without it, errors hit the
#    caller's stderr and the real cause is visible immediately.
#
# 3. -onlyUsePackageVersionsFromResolvedFile: locks SwiftPM resolution to the
#    committed Package.resolved, preventing version drift on cold builds.
#
# 4. Output validation gate: even when xcodebuild exits 0, the .app can be a
#    stub bundle (only Expo.plist + Frameworks/__preview.dylib, no main
#    executable, no Info.plist). The validation gate catches this before
#    caching garbage to disk and installs downstream tooling (simctl install).

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
mobile_dir="$repo_root/mobile"
cache_dir="$mobile_dir/.qa-cache"

mkdir -p "$cache_dir"

# Cache key: tree SHA of `mobile/` so the bundle invalidates whenever any
# mobile file changes (incl. native config) but stays warm across pure web /
# backend edits.
sha="$(git -C "$repo_root" rev-parse HEAD:mobile)"
cached_app="$cache_dir/$sha.app"

if [[ -d "$cached_app" ]]; then
  echo "$cached_app"
  exit 0
fi

# Generate native iOS project on first run (or after blowing away mobile/ios/).
if [[ ! -d "$mobile_dir/ios" ]]; then
  echo "[qa-build] mobile/ios/ missing — running expo prebuild" >&2
  (cd "$mobile_dir" && npx expo prebuild --platform ios --no-install)
fi

# Ensure CocoaPods dependencies are resolved before invoking xcodebuild.
# If Pods/Manifest.lock is missing or diverges from Podfile.lock (e.g. after
# a dependency bump or fresh checkout), xcodebuild fails to resolve target
# dependencies before Expo/Nitro can emit their modulemaps — the cold-build
# race that produces 33+ "module map file not found" errors.
pods_manifest="$mobile_dir/ios/Pods/Manifest.lock"
podfile_lock="$mobile_dir/ios/Podfile.lock"
if [[ ! -f "$pods_manifest" ]] || ! diff -q "$pods_manifest" "$podfile_lock" > /dev/null 2>&1; then
  echo "[qa-build] Pods/Manifest.lock missing or diverged — running pod install" >&2
  (cd "$mobile_dir/ios" && pod install) >&2
fi

workspace="$(find "$mobile_dir/ios" -maxdepth 2 -name "*.xcworkspace" -print -quit)"
if [[ -z "$workspace" ]]; then
  echo "[qa-build] FATAL: no .xcworkspace under mobile/ios/" >&2
  exit 1
fi

# Read the iOS scheme from the project. Expo prebuild names it after
# expo.name -> sanitized; this picks the first scheme in the workspace.
scheme="$(xcodebuild -workspace "$workspace" -list -json 2>/dev/null \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["workspace"]["schemes"][0])')"

if [[ -z "$scheme" ]]; then
  echo "[qa-build] FATAL: could not determine xcodebuild scheme" >&2
  exit 1
fi

derived="$cache_dir/.derived-$sha"
echo "[qa-build] Building scheme=$scheme workspace=$workspace (sha=$sha)" >&2
xcodebuild \
  -workspace "$workspace" \
  -scheme "$scheme" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$derived" \
  -onlyUsePackageVersionsFromResolvedFile \
  build >&2

built_app="$(find "$derived/Build/Products/Debug-iphonesimulator" -maxdepth 2 -name "*.app" -print -quit)"
if [[ -z "$built_app" || ! -d "$built_app" ]]; then
  echo "[qa-build] FATAL: build succeeded but no .app under $derived" >&2
  exit 1
fi

# Validate the produced .app before caching. Even when xcodebuild exits 0 it
# can produce a stub bundle (only Expo.plist + Frameworks/__preview.dylib, no
# main executable, no Info.plist) when the cold-build race occurred silently.
# Require Info.plist AND the main binary named after the scheme (Expo prebuild
# names the executable after the app scheme by convention).
info_plist="$built_app/Info.plist"
main_binary="$built_app/$scheme"

if [[ ! -f "$info_plist" ]] || [[ ! -f "$main_binary" ]]; then
  echo "[qa-build] FATAL: build returned success but produced no executable .app. See xcodebuild output above for the real cause." >&2
  # Rename rather than rm -rf so the caller can inspect the stub if needed.
  mv "$built_app" "${built_app}.invalid" 2>/dev/null || true
  exit 1
fi

# Copy to cache, then drop derived data — we only keep the .app, not the
# multi-GB build intermediates.
cp -R "$built_app" "$cached_app"
rm -rf "$derived"

echo "$cached_app"
