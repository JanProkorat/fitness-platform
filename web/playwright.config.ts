/**
 * Playwright configuration for the trainer web portal E2E test suite.
 *
 * Architecture:
 *   - globalSetup calls POST /test/reset on the compose harness before any
 *     spec runs, so the DB starts from the deterministic seeded baseline
 *     (QaSeedRunner). Each CI run is idempotent; the previous run's data
 *     cannot bleed into the next.
 *   - A `setup` project runs auth.setup.ts and produces .auth/<role>.json
 *     storage-state files for each QA role.
 *   - The `trainer`, `client`, and `nutritionist` projects depend on `setup`
 *     and pick up the corresponding storage-state file so no spec ever visits
 *     the login page at runtime.
 *
 * Compose harness:
 *   Boot with `npm run e2e:up` (docker-compose.test.yml) before running specs.
 *   The harness API lives at E2E_API_URL (default https://localhost:5101).
 *   The Vite dev server (dev:e2e) proxies all API paths to that URL.
 *
 * TLS note: the compose harness uses a self-signed dev cert. Set
 * `ignoreHTTPSErrors: true` on the browser context so fetch/XHR calls inside
 * the SPA succeed. The global-setup Node https request already uses
 * rejectUnauthorized:false for the same reason.
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
    /* All page navigations use the Vite dev server as base */
    baseURL: 'http://localhost:5173',

    /* The app talks to the compose harness through the Vite proxy; the
       harness uses a self-signed dev cert, so ignore TLS errors inside
       the browser context. */
    ignoreHTTPSErrors: true,

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ─── Auth setup — runs first, produces .auth/*.json ──────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // ─── Trainer-scoped specs ─────────────────────────────────────────────────
    {
      name: 'trainer',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/trainer.json',
      },
    },

    // ─── Client-scoped specs ──────────────────────────────────────────────────
    {
      name: 'client',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/client.json',
      },
    },

    // ─── Nutritionist-scoped specs ────────────────────────────────────────────
    {
      name: 'nutritionist',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/nutritionist.json',
      },
    },
  ],

  /* Web server: spawn `npm run dev:e2e` automatically.
     - reuseExistingServer lets local devs keep the server running (faster iteration).
     - In CI the server is always spawned fresh for isolation.
     The server must be healthy on :5173 before specs start.
  */
  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
    // Forward the E2E_API_URL so the Vite proxy knows where to point
    env: {
      E2E_API_URL,
    },
  },
});
