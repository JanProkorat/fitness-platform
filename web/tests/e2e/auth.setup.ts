/**
 * Playwright auth setup — logs each QA role in via the real compose harness
 * and persists the browser storage state to .auth/<role>.json.
 *
 * This runs once as a dependency before any spec project (trainer / client /
 * nutritionist). Subsequent spec runs reuse the stored auth state so the login
 * form is never visited again during the test suite.
 *
 * Credentials come from QA_SEED_PASSWORD (env var, never hardcoded). Copy
 * .env.test.example to .env.test and set a value before running.
 *
 * The seeded emails are stable fixture constants defined in QaSeedRunner.cs:
 *   qa.trainer@fitnessplatform.test
 *   qa.client@fitnessplatform.test
 *   qa.nutri@fitnessplatform.test
 *
 * Auth flow for this app:
 *   1. Fill the /login form (email + password).
 *   2. Submit → the app stores refreshToken in localStorage and navigates to /dashboard.
 *   3. Save storageState (localStorage + cookies) to .auth/<role>.json.
 *
 * Error handling:
 *   - Missing QA_SEED_PASSWORD → fail fast with a clear message pointing at .env.test.example.
 *   - Login failure (wrong password, network error) → the waitForURL will timeout and
 *     Playwright will surface the actual page content for diagnosis.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'node:path';

const ROLES = [
  {
    role: 'trainer',
    email: 'qa.trainer@fitnessplatform.test',
    storageStatePath: path.resolve('.auth/trainer.json'),
    /** Trainers land on /dashboard after login */
    expectedUrl: '**/dashboard',
  },
  {
    role: 'client',
    email: 'qa.client@fitnessplatform.test',
    storageStatePath: path.resolve('.auth/client.json'),
    /** Clients (portal login) redirect to /download-app */
    expectedUrl: '**/download-app',
  },
  {
    role: 'nutritionist',
    email: 'qa.nutri@fitnessplatform.test',
    storageStatePath: path.resolve('.auth/nutritionist.json'),
    /** Nutritionists land on /dashboard after login */
    expectedUrl: '**/dashboard',
  },
] as const;

for (const { role, email, storageStatePath, expectedUrl } of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    // Fail fast if the QA password is not configured — do this at runtime
    // (not module-load time) so `playwright test --list` still works.
    const password = process.env['QA_SEED_PASSWORD'];
    if (!password) {
      throw new Error(
        'QA_SEED_PASSWORD is not set. ' +
          'Copy .env.test.example to .env.test, fill it in, then ' +
          '`source .env.test` or load it with dotenv before running Playwright.',
      );
    }

    await page.goto('/login');

    // Fill email
    await page.locator('input[type="email"]').fill(email);

    // Fill password
    await page.locator('input[type="password"]').fill(password);

    // Submit the login form
    await page.locator('button[type="submit"]').click();

    // Wait for the post-login redirect to confirm auth succeeded.
    // If this times out, the page content will show the error state.
    await page.waitForURL(expectedUrl, { timeout: 30_000 });

    // Confirm we are NOT on the login page (belt-and-suspenders)
    await expect(page).not.toHaveURL('**/login');

    // Persist the authenticated browser context (localStorage + cookies)
    await page.context().storageState({ path: storageStatePath });
    console.log(`[auth-setup] Saved ${role} storage state to ${storageStatePath}`);
  });
}
