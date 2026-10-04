/**
 * Durable spec — v1 app shell smoke test (#1051).
 *
 * Proves the phase-0 foundation end-to-end against the compose harness:
 *   1. API-driven auth (auth.setup.ts / trainerTest) reaches a protected
 *      route without ProtectedRoute looping back to "/".
 *   2. The app shell renders (sidebar with the v1 nav, top bar).
 *   3. Client-side routing between nav items actually swaps page content.
 *
 * Runs under the `trainer` project, authenticated via the `trainerTest`
 * export in ../fixtures/auth.ts (#897 — mints a fresh per-attempt refresh
 * token rather than reusing the shared .auth/trainer.json token).
 */
import { trainerTest as test, expect } from '../fixtures/auth';

test('app shell renders the v1 nav and routes between pages', async ({ page }) => {
  await page.goto('/clients');

  // Wait for restoreSession() (POST /auth/refresh on mount) to complete
  // before asserting page content.
  await page.waitForLoadState('networkidle');

  // Confirm ProtectedRoute did not bounce us back to the public entry route.
  await expect(page).toHaveURL(/\/clients$/);

  // Sidebar renders all four v1 nav items — nothing more (design spec §9:
  // "the v1 sidebar shows only what v1 delivers").
  const nav = page.getByRole('navigation');
  await expect(nav.getByText('Clients', { exact: true })).toBeVisible();
  await expect(nav.getByText('Inbox', { exact: true })).toBeVisible();
  await expect(nav.getByText('Ingredients', { exact: true })).toBeVisible();
  await expect(nav.getByText('Recipes', { exact: true })).toBeVisible();

  // Top bar renders the sign-out control.
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

  // Routing: clicking a different nav item swaps the page heading.
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  await nav.getByText('Inbox', { exact: true }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
});
