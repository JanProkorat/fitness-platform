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
 *   Boot with `scripts/test-env up` (or `npm run e2e:up`) before running specs.
 *   The harness API lives at E2E_API_URL (default https://localhost:5101 for
 *   host runs; the qa-playwright container overrides to https://api:8080).
 *   The Vite dev server (dev:e2e) proxies all API paths to that URL.
 *
 * baseURL:
 *   Host runs default to http://localhost:5173 (Vite dev server). The
 *   dockerised qa-playwright container overrides baseURL to http://web:5173
 *   via PLAYWRIGHT_BASE_URL — the `web` service is on the same qa-net
 *   network so DNS resolution works inside the browser context.
 *   Specs that target mobile-web (e.g. user-avatar-upload) override the
 *   per-test baseURL via test.use({ baseURL: 'http://mobile-web:8081' }).
 *
 * TLS note: the compose harness uses a self-signed dev cert. Set
 * `ignoreHTTPSErrors: true` on the browser context so fetch/XHR calls inside
 * the SPA succeed. The global-setup Node https request already uses
 * rejectUnauthorized:false for the same reason.
 *
 * Env loading:
 *   .env.test (gitignored) in the repo root supplies QA_SEED_PASSWORD and
 *   JWT_SECRET to auth.setup.ts and global-setup.ts. dotenv.config does NOT
 *   override existing shell exports, so local devs and CI can still inject
 *   values via their own environment. Copy .env.test.example → .env.test and
 *   fill it in for local runs — do NOT source it manually first.
 *
 *   New spec authors: the globalSetup resets the database via POST /test/reset
 *   before any spec project runs. Add new specs to tests/e2e/<role>/ and rely
 *   on this reset rather than setting up data manually to avoid inter-run
 *   data contamination.
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// ESM-safe __dirname substitute (package.json has "type":"module").
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load QA_SEED_PASSWORD (and any other test-only vars) from .env.test in the
// repo root. dotenv silently no-ops when the file is absent (CI sets the vars
// via shell env before this runs). Does NOT override already-set env vars, so
// shell exports and GitHub Actions secrets always win.
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

const E2E_API_URL = process.env['E2E_API_URL'] ?? 'https://localhost:5101';

// Base URL for `page.goto('/...')`. Host runs use the Vite dev server on
// localhost:5173; the dockerised playwright container overrides this to the
// internal `http://web:5173` (qa-net DNS) via the PLAYWRIGHT_BASE_URL env.
const PLAYWRIGHT_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:5173';

// Flip to skip the auto-spawned webServer when running inside the qa-playwright
// container — the dockerised `web` service IS the SPA host, so spawning a
// second `npm run dev:e2e` inside the playwright container would clash.
const IN_CONTAINER = process.env['PLAYWRIGHT_IN_CONTAINER'] === 'true';

// When Playwright runs inside the qa-playwright container, the SPA is served
// over http://web:5173 and http://mobile-web:8081 — plain HTTP, not localhost.
// Chromium treats non-localhost HTTP origins as insecure contexts, which makes
// window.crypto.randomUUID (and other secure-context APIs) undefined. Adding
// these launch args tells Chromium to treat those specific origins as secure so
// the app behaves identically to a localhost host run.
// These args MUST NOT be applied to host/localhost runs (they're a no-op there
// but would widen the attack surface unnecessarily).
const containerLaunchOptions = IN_CONTAINER
  ? {
      launchOptions: {
        args: [
          '--unsafely-treat-insecure-origin-as-secure=http://web:5173,http://mobile-web:8081',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      },
    }
  : {};

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
    /* All page navigations use the configured base URL */
    baseURL: PLAYWRIGHT_BASE_URL,

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
        ...containerLaunchOptions,
      },
    },

    // ─── Trainer-scoped specs ─────────────────────────────────────────────────
    // Picks up only tests/e2e/trainer/**. Add new trainer-role specs there so
    // they are never duplicated by the client or nutritionist projects.
    // Each spec should call page.waitForLoadState('networkidle') after
    // page.goto('/dashboard') to let the auth-store's restoreSession()
    // (POST /auth/refresh on mount) complete before asserting page content.
    // The globalSetup calls POST /test/reset before this project runs, so
    // the DB is at the deterministic QA seed baseline.
    {
      name: 'trainer',
      dependencies: ['setup'],
      testMatch: /trainer\/.+\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/trainer.json',
        ...containerLaunchOptions,
      },
    },

    // ─── Client-scoped specs ──────────────────────────────────────────────────
    // Picks up only tests/e2e/client/**. Add new client-role specs there.
    // user-avatar-upload targets the dockerised mobile-web service via
    // PLAYWRIGHT_BASE_URL=http://mobile-web:8081 — that DNS only resolves
    // inside the qa-net network, so we exclude the spec from host runs.
    {
      name: 'client',
      dependencies: ['setup'],
      testMatch: /client\/.+\.spec\.ts/,
      testIgnore: IN_CONTAINER ? [] : [/client\/user-avatar-upload\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/client.json',
        ...containerLaunchOptions,
      },
    },

    // ─── Nutritionist-scoped specs ────────────────────────────────────────────
    // Picks up only tests/e2e/nutritionist/**. Add new nutritionist-role specs there.
    // food-admin-upload and recipe-gallery-upload are container-driven canonical
    // AC flows — their selectors are exercised by `scripts/test-env run <flow>`
    // inside qa-playwright (where the seeded fixtures + dockerised web service
    // are the source of truth). Excluded from host runs to keep regression
    // smoke (trainer/clients.spec.ts) fast and deterministic.
    {
      name: 'nutritionist',
      dependencies: ['setup'],
      testMatch: /nutritionist\/.+\.spec\.ts/,
      testIgnore: IN_CONTAINER
        ? []
        : [
            /nutritionist\/food-admin-upload\.spec\.ts/,
            /nutritionist\/recipe-gallery-upload\.spec\.ts/,
          ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/nutritionist.json',
        ...containerLaunchOptions,
      },
    },
  ],

  /* Web server: spawn `npm run dev:e2e` automatically — UNLESS we're running
     inside the qa-playwright container, where the `web` service already
     serves the SPA on http://web:5173 over the internal docker network.
     - reuseExistingServer lets local devs keep the server running (faster iteration).
     - In CI (host runner) the server is always spawned fresh for isolation.
     The server must be healthy on :5173 before specs start.
  */
  webServer: IN_CONTAINER
    ? undefined
    : {
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
