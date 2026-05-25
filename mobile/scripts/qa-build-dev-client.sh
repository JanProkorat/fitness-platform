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
#
# 5. Two-pass build to break the cold-cache modulemap race (#295): even after
#    pod install, xcodebuild's default parallel target scheduling can start the
#    main target's Swift compilation (AppDelegate.swift) before CocoaPods
#    dependency targets (Expo, Nitro, SwiftUIIntrospect, etc.) have emitted
#    their modulemaps, producing 30+ "module map file not found" errors. The
#    fix is a pre-pass that builds only the Pods-<AppName> aggregate scheme
#    (which compiles every CocoaPods dependency and emits all their modulemaps
#    into derivedDataPath) BEFORE the main scheme build begins. Both passes
#    share the same -derivedDataPath so the second pass picks up the already-
#    emitted modulemaps from the cache and skips recompiling them.
#    NOTE: -parallelizeTargets is a boolean switch (enables parallelism; no
#    argument accepted); there is no CLI flag to disable it — confirmed via
#    xcrun xcodebuild --help. The two-pass approach is the correct solution.
#    The workspace lookup uses -maxdepth 1 so find returns the CocoaPods-
#    augmented GFPlatform.xcworkspace (depth 1) and never the Xcode-generated
#    project.xcworkspace nested inside GFPlatform.xcodeproj/ (depth 2).
#
# 6. Scheme-existence assertion: after deriving pods_scheme from the workspace
#    basename, the script verifies that scheme is actually listed in the
#    workspace before launching the pre-pass. This converts a wrong-scheme
#    silent exit-65 into a loud FATAL with the available scheme names.

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

workspace="$(find "$mobile_dir/ios" -maxdepth 1 -name "*.xcworkspace" -print -quit)"
if [[ -z "$workspace" ]]; then
  echo "[qa-build] FATAL: no .xcworkspace under mobile/ios/" >&2
  exit 1
fi

# Derive the app scheme name from the workspace file name. Expo prebuild names
# the workspace (and app scheme) after expo.name -> sanitized (e.g.
# "GFPlatform.xcworkspace" → scheme "GFPlatform"). Using the workspace basename
# is more reliable than picking schemes[0] from -list, which returns schemes in
# alphabetical order (CocoaPods schemes like EXApplication sort before the app).
scheme="$(basename "$workspace" .xcworkspace)"

if [[ -z "$scheme" ]]; then
  echo "[qa-build] FATAL: could not determine xcodebuild scheme" >&2
  exit 1
fi

derived="$cache_dir/.derived-$sha"

# Pre-pass: build Pods-<AppName> aggregate scheme first so every CocoaPods
# dependency target emits its modulemaps into $derived before the main scheme
# Swift compilation starts. This is the two-pass fix for the cold-cache
# modulemap race (#295): parallel target scheduling in xcodebuild can otherwise
# start AppDelegate.swift before Expo/Nitro/SwiftUIIntrospect modulemaps land.
# Both passes share -derivedDataPath so the second pass picks up the
# already-compiled Pods and skips recompiling them.
pods_scheme="Pods-${scheme}"

# Assert that pods_scheme exists in the workspace before attempting the pre-pass.
# A wrong scheme causes xcodebuild to exit 65 with a cryptic "does not contain a
# scheme" error. This guard catches it early and prints the schemes that ARE present.
if ! xcrun xcodebuild -workspace "$workspace" -list -json 2>/dev/null \
     | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if '$pods_scheme' in d['workspace']['schemes'] else 1)"; then
  echo "[qa-build] FATAL: expected scheme '$pods_scheme' not found in workspace. Schemes present:" >&2
  xcrun xcodebuild -workspace "$workspace" -list -json 2>/dev/null \
    | python3 -c "import json,sys; print('\n'.join(json.load(sys.stdin)['workspace']['schemes']))" >&2
  exit 1
fi

echo "[qa-build] Pre-emitting Pods modulemaps to break cold-cache race (scheme=$pods_scheme)" >&2
xcrun xcodebuild \
  -workspace "$workspace" \
  -scheme "$pods_scheme" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$derived" \
  -onlyUsePackageVersionsFromResolvedFile \
  build >&2

echo "[qa-build] Building main scheme=$scheme workspace=$workspace (sha=$sha)" >&2
xcrun xcodebuild \
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
