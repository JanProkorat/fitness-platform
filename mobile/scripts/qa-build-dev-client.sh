#!/usr/bin/env bash
# Build a fresh Expo dev-client .app for the iOS Simulator and cache it by
# mobile-tree SHA. qa-tester invokes this whenever it needs to drive the
# native app via XcodeBuildMCP; humans can run it directly to refresh the
# cache. Cold builds take 5–8 min; cache hits return in <1s.
#
# Output: a single absolute path on stdout pointing at the cached .app bundle.

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
  -quiet \
  build >&2

built_app="$(find "$derived/Build/Products/Debug-iphonesimulator" -maxdepth 2 -name "*.app" -print -quit)"
if [[ -z "$built_app" || ! -d "$built_app" ]]; then
  echo "[qa-build] FATAL: build succeeded but no .app under $derived" >&2
  exit 1
fi

# Copy to cache, then drop derived data — we only keep the .app, not the
# multi-GB build intermediates.
cp -R "$built_app" "$cached_app"
rm -rf "$derived"

echo "$cached_app"
