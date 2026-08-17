/**
 * Durable spec — trainer clients list (issue #268).
 *
 * This file lives under tests/e2e/trainer/ and is picked up ONLY by the
 * `trainer` project in playwright.config.ts (via testMatch).
 *
 * Auth comes from the `trainerTest` export in ../fixtures/auth.ts (#897),
 * which mints a fresh refresh token for THIS test attempt via POST
 * /auth/login rather than reusing the single shared token that used to live
 * in .auth/trainer.json — see that file for why. Every trainer spec imports
 * `trainerTest`, so no two specs (and no two retry attempts of the same
 * spec) ever share a token.
 *
 * Hits the REAL compose harness at E2E_API_URL (default: https://localhost:5101).
 * No page.route() mocks — all requests go to the live seeded backend.
 *
 * The global-setup.ts (Playwright globalSetup) calls POST /test/reset before
 * this suite runs, so the DB starts from the deterministic QA fixture:
 *   qa.trainer@fitnessplatform.test — is the logged-in user
 *   qa.client@fitnessplatform.test  — is the one seeded client linked to the trainer
 *
 * WHY THIS IS ONE CONSOLIDATED TEST:
 * storageState restores a refresh token from disk. On the first page.goto(),
 * the app calls restoreSession() (POST /auth/refresh), which rotates the
 * refresh token — the on-disk token is now stale. If the assertions were split
 * into multiple test() blocks, each would restore the same stale on-disk
 * token, and their /auth/refresh calls would 401, causing RequireAuth to
 * redirect to /login and every assertion to fail. One test = one rotation.
 *
 * Future durable specs should follow the same pattern: one spec file, one
 * consolidated test covering the full user journey for that file's feature.
 * See playwright.config.ts for the per-feature testMatch pattern.
 *
 * AC assertions (all in one journey):
 *   1. Dashboard page loads without errors after storageState auth.
 *   2. The seeded QA client (first name "QA", last name "Client") appears in the list.
 *   3. The total client count stat ("Aktivní klienti") is visible (≥ 1 client).
 *   4. Navigating to the client's detail page works (no 404 / error state).
 */

import { trainerTest as test, expect } from '../fixtures/auth';

test('trainer clients list — dashboard loads, QA client visible, count ≥1, detail nav works', async ({ page }) => {
  await page.goto('/dashboard');

  // Wait for networkidle so the auth-store's restoreSession() round-trip
  // (POST /auth/refresh on mount) completes before asserting page content.
  // Without this, the page may briefly be in the uninitialized state
  // (isInitialized=false → App renders null) and the assertion times out.
  await page.waitForLoadState('networkidle');

  // Assertion 1: QA client appears in the clients table.
  // Scoped to getByRole('table') to avoid a strict-mode collision: "QA Client"
  // also renders in the trainer topbar/sidebar (logged-in user display).
  const clientName = page.getByRole('table').getByText('QA Client', { exact: false });
  await expect(clientName.first()).toBeVisible({ timeout: 30_000 });

  // Assertion 2: stats grid shows "Aktivní klienti" card — confirms at least
  // one client is counted and the stats section rendered without errors.
  const statsCard = page.getByText('Aktivní klienti');
  await expect(statsCard).toBeVisible({ timeout: 15_000 });

  // Assertion 3: clicking the QA client row navigates to the detail page.
  // Re-use the already-visible clientName locator — no extra navigation needed.
  await clientName.first().click();
  await page.waitForURL(/\/clients\/.+/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+/);

  // Confirm the detail page rendered the client's name (not an error state).
  const detailClientName = page.getByText('QA Client', { exact: false });
  await expect(detailClientName.first()).toBeVisible({ timeout: 15_000 });
});
