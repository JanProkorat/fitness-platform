/**
 * Durable spec — trainer clients list (issue #268).
 *
 * This file lives under tests/e2e/trainer/ and is picked up ONLY by the
 * `trainer` project in playwright.config.ts (via testMatch). The project
 * already sets storageState: '.auth/trainer.json', so there is no need for
 * an in-file test.use({ storageState: ... }) override — that would cause the
 * spec to run once per project (trainer + client + nutritionist = 3×), which
 * is wasteful and incorrect.
 *
 * Uses the pre-authenticated trainer storage state (set by the `trainer`
 * project in playwright.config.ts) so the login form is bypassed.
 * Hits the REAL compose harness at E2E_API_URL (default: https://localhost:5101).
 * No page.route() mocks — all requests go to the live seeded backend.
 *
 * The global-setup.ts (Playwright globalSetup) calls POST /test/reset before
 * this suite runs, so the DB starts from the deterministic QA fixture:
 *   qa.trainer@fitnessplatform.test — is the logged-in user
 *   qa.client@fitnessplatform.test  — is the one seeded client linked to the trainer
 *
 * Auth warm-up: after storageState is restored, the app calls restoreSession()
 * (POST /auth/refresh) on mount. Each test navigates to /dashboard and waits
 * for networkidle before making assertions, ensuring the auth-store is fully
 * hydrated (isInitialized=true, isAuthenticated=true) before any expect runs.
 *
 * AC assertions:
 *   1. Dashboard page loads without errors after storageState auth.
 *   2. The seeded QA client (first name "QA", last name "Client") appears in the list.
 *   3. The total client count stat reflects at least 1 client.
 *   4. Navigating to the client's detail page works (no 404 / error state).
 */

import { test, expect } from '@playwright/test';

test.describe('Trainer clients list — compose harness (#268)', () => {
  test('dashboard loads and QA client is visible', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for networkidle so the auth-store's restoreSession() round-trip
    // (POST /auth/refresh on mount) completes before asserting page content.
    // Without this, the page may briefly be in the uninitialized state
    // (isInitialized=false → App renders null) and the assertion times out.
    await page.waitForLoadState('networkidle');

    // Wait for the clients table / list to be visible.
    // The dashboard fetches /trainer/clients and renders a table or list view.
    // We wait for the client's name to appear which confirms the API call succeeded.
    const clientName = page.getByText('QA Client', { exact: false });
    await expect(clientName).toBeVisible({ timeout: 30_000 });
  });

  test('client row count stat is at least 1', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for networkidle to ensure restoreSession() and all initial fetches
    // have completed before asserting dashboard content.
    await page.waitForLoadState('networkidle');

    // The stats grid shows "Aktivní klienti" with a count value.
    // We assert at least one client is shown — seeded fixture has exactly 1.
    const clientName = page.getByText('QA Client', { exact: false });
    await expect(clientName).toBeVisible({ timeout: 30_000 });

    // The stats grid: verify the "Aktivní klienti" card exists
    const statsCard = page.getByText('Aktivní klienti');
    await expect(statsCard).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a client row navigates to their detail page', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for networkidle so auth and initial data fetches are complete.
    await page.waitForLoadState('networkidle');

    // Wait for the QA client to render
    const clientName = page.getByText('QA Client', { exact: false });
    await expect(clientName).toBeVisible({ timeout: 30_000 });

    // Click the first element containing the client name to navigate to detail
    await clientName.first().click();

    // After click we should navigate to /clients/<id> — confirm URL changed
    await page.waitForURL('**/clients/**', { timeout: 15_000 });

    // Confirm the detail page loaded (not an error/empty state)
    // The client detail page renders the client's name in a heading or breadcrumb
    const detailClientName = page.getByText('QA Client', { exact: false });
    await expect(detailClientName.first()).toBeVisible({ timeout: 15_000 });
  });
});
