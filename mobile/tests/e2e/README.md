# Mobile E2E Tests (react-native-web slice)

This folder holds Playwright tests targeting the `react-native-web` render of
the mobile app — the bundle produced by `npx expo start --web`. Playwright
drives a browser against that bundle, which means all platform-agnostic UI
flows (authentication, today screen states, messaging, trainer discovery) can
be covered here with the same tooling used for the web portal.

## What is NOT covered here

Native-only flows — MMKV persistence, haptics, camera, native navigation
transitions, platform pickers (iOS `ActionSheet`, `DateTimePicker`) — cannot
run through the `react-native-web` render. Those ACs are verified via
XcodeBuildMCP against the iOS Simulator build produced by
`mobile/scripts/qa-build-dev-client.sh`. If a spec needs native behaviour,
it belongs in that pipeline, not here.

## Quick start

Boot the compose test harness from the repo root first, then run the specs:

```bash
# 1. Start the compose harness (postgres + mongo + minio + seeded API on :5101)
npm run e2e:up

# 2. From the mobile package, run the Playwright suite
cd mobile
npx playwright test
```

The `playwright.config.ts` will automatically spawn `npx expo start --web
--port 8081` if no server is already listening on that port
(`reuseExistingServer: !process.env.CI`). In CI the server is always spawned
fresh.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `E2E_API_URL` | `https://localhost:5101` | URL of the compose harness API. Passed to `global-setup.ts` for the `/test/reset` call and forwarded to the Expo web server so the app knows where to point its Axios client. |

Override the default when the harness runs on a non-standard port or host:
```bash
E2E_API_URL=https://localhost:5200 npx playwright test
```

## StorageState roles

StorageState-aware role projects (trainer / client / nutritionist) are **not
configured yet**. The `playwright.config.ts` currently has a single
`mobile-web` project with no pre-authenticated session. The first durable spec
and the corresponding `auth.setup.ts` will land in a follow-up issue — see the
web package's `tests/e2e/auth.setup.ts` for the pattern to mirror.
