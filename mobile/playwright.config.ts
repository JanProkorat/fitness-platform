/**
 * Playwright configuration for the mobile app's react-native-web E2E test slice.
 *
 * Architecture:
 *   - This config targets the react-native-web bundle rendered by Expo's web
 *     target. It is intentionally thin — no storageState roles yet.
 *   - Native-only flows (MMKV, haptics, camera, native nav transitions,
 *     platform pickers) are NOT covered here. Those run via XcodeBuildMCP
 *     against the iOS Simulator build produced by scripts/qa-build-dev-client.sh.
 *   - globalSetup calls POST /test/reset on the compose harness before any
 *     spec runs, so the DB starts from the deterministic seeded baseline.
 *
 * Compose harness:
 *   Boot with `npm run e2e:up` (docker-compose.test.yml) from the repo root
 *   before running specs. The harness API lives at E2E_API_URL (default
 *   https://localhost:5101).
 *
 * Web server:
 *   Expo's web bundle is served on :8081 via `npx expo start --web --port 8081`.
 *   reuseExistingServer lets local devs keep the server running; in CI a fresh
 *   server is always spawned.
 *
 * TLS note: the compose harness uses a self-signed dev cert. The global-setup
 * Node https request uses rejectUnauthorized:false for the same reason.
 * ignoreHTTPSErrors covers API calls made from within the browser context.
 *
 * StorageState roles:
 *   Not configured yet — the first durable spec is intentionally deferred to a
 *   follow-up issue. A future PR will add a setup project that mirrors
 *   web/tests/e2e/auth.setup.ts and produces .auth/<role>.json files.
 */

import { defineConfig, devices } from '@playwright/test';

const E2E_API_URL = process.env['E2E_API_URL'] ?? 'https://localhost:5101';

export default defineConfig({
  testDir: './tests/e2e',

  globalSetup: './tests/e2e/global-setup.ts',

  /* Retries: 2 in CI, 0 locally (dev gets immediate feedback) */
  retries: process.env['CI'] ? 2 : 0,

  /* Workers: 1 in CI for reproducibility, undefined (cpu-count) locally */
  workers: process.env['CI'] ? 1 : undefined,

  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    /* Expo web bundle base URL */
    baseURL: 'http://localhost:8081',

    /* The app talks to the compose harness directly; the harness uses a
       self-signed dev cert, so ignore TLS errors inside the browser context. */
    ignoreHTTPSErrors: true,

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ─── react-native-web render slice ───────────────────────────────────────
    // No storageState roles yet — add a `setup` project here in the follow-up
    // that introduces the first durable spec (mirrors web's auth.setup.ts).
    {
      name: 'mobile-web',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],

  /* Web server: spawn `npx expo start --web --port 8081` automatically.
     - reuseExistingServer lets local devs keep the server running (faster
       iteration). In CI the server is always spawned fresh for isolation.
     The server must be healthy on :8081 before specs start.
  */
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      E2E_API_URL,
    },
  },
});
