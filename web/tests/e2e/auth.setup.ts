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
 *
 * ── Mobile-web client auth (#376) ──────────────────────────────────────────
 * `.auth/client.json` above is captured on the trainer-portal origin
 * (this app, served at :5173/web:5173). Playwright's storageState is
 * origin-scoped, so it does NOT authenticate the mobile-web Expo bundle at
 * a different origin (mobile-web:8081) — the avatar-upload spec
 * (tests/e2e/client/user-avatar-upload.spec.ts) needs its own storage state
 * captured against THAT origin. The extra setup test below drives the real
 * React-Native-Web login form (matching this file's own philosophy of
 * exercising the real form rather than injecting a token) and saves
 * `.auth/mobile-web-client.json`.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'node:path';

/** Mirrors the override in user-avatar-upload.spec.ts — see that file. */
const MOBILE_WEB_BASE_URL = process.env['MOBILE_WEB_BASE_URL'] ?? 'http://localhost:8081';

/**
 * The mobile-web auth setup only runs inside the qa-playwright container,
 * where the `mobile-web` service DNS name resolves. On host runs (and in
 * regular CI, before the orchestrator's Phase 5 container run) `mobile-web`
 * doesn't exist, and the corresponding spec is already excluded via
 * playwright.config.ts's `testIgnore` — skip the auth step for the same
 * reason instead of failing on an unreachable host.
 */
const IN_CONTAINER = process.env['PLAYWRIGHT_IN_CONTAINER'] === 'true';

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

    // Warm up the auth-store: App.tsx calls restoreSession() in a useEffect on
    // every mount. Because restorePromise is null after a login (the pre-login
    // no-op call already resolved), restoreSession re-runs on the post-login
    // page and calls POST /auth/refresh. Waiting for networkidle ensures this
    // round-trip completes and the updated refreshToken is written to
    // localStorage BEFORE we snapshot the storageState.
    //
    // Without this wait the storageState sometimes captures the original
    // refreshToken (from the /auth/login response) before the /auth/refresh
    // response has rotated it. The spec contexts then start with a stale token
    // and the first restoreSession call in the spec may fail if the original
    // token was already consumed.
    await page.waitForLoadState('networkidle', { timeout: 30_000 });

    // Persist the authenticated browser context (localStorage + cookies).
    // At this point localStorage contains the refreshToken written by the
    // /auth/refresh response (the most recent rotation), which the spec
    // contexts will use to bootstrap their own restoreSession calls.
    await page.context().storageState({ path: storageStatePath });
    console.log(`[auth-setup] Saved ${role} storage state to ${storageStatePath}`);
  });
}

// ── Mobile-web client auth (#376) ────────────────────────────────────────────
// Separate from the ROLES loop above: this drives the mobile-web Expo bundle's
// own React-Native-Web login screen (app/(auth)/login.tsx), which renders
// different DOM than the trainer portal's LoginPage.tsx (no type="submit"
// button; TextInput maps to <input autocomplete="...">). Produces its own
// storageState scoped to the mobile-web:8081 origin.
setup('authenticate as mobile-web client', async ({ page }) => {
  if (!IN_CONTAINER) {
    setup.skip(true, 'mobile-web only resolves inside the qa-playwright container (see IN_CONTAINER above).');
    return;
  }

  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error(
      'QA_SEED_PASSWORD is not set. ' +
        'Copy .env.test.example to .env.test, fill it in, then ' +
        '`source .env.test` or load it with dotenv before running Playwright.',
    );
  }

  // Absolute URL — deliberately bypasses the project's configured baseURL
  // (the trainer-portal origin) since this test targets a different service.
  await page.goto(`${MOBILE_WEB_BASE_URL}/login`);

  // react-native-web maps TextInput's `autoComplete` prop to the DOM
  // `autocomplete` attribute — stable across cs/en/de, unlike the visible
  // placeholder text (which the trainer portal's `input[type="email"]`
  // selector doesn't need to worry about, but this RN-Web form's inputs
  // don't reliably carry type="email"/"password" the way plain HTML does).
  await page.locator('input[autocomplete="email"]').fill('qa.client@fitnessplatform.test');
  await page.locator('input[autocomplete="password"]').fill(password);

  // The sign-in control is a RN TouchableOpacity (renders as a div/button
  // with no type="submit"), so locate it by its accessible name instead —
  // same pattern user-avatar-upload.spec.ts already uses for the camera
  // badge. cs/en/de values for auth.login.signIn.
  const signInButton = page.getByRole('button', {
    name: /Přihlásit se|Sign in|Anmelden/i,
  });
  await signInButton.click();

  // Wait for the post-login redirect away from /login (AuthGate routes to
  // the Today tab, or to the questionnaire/onboarding flow if pending —
  // either way, off /login confirms auth succeeded).
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/);

  // Same rotation-race rationale as the ROLES loop above — let restoreSession's
  // /auth/refresh round-trip finish before snapshotting storageState.
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  const storageStatePath = path.resolve('.auth/mobile-web-client.json');
  await page.context().storageState({ path: storageStatePath });
  console.log(`[auth-setup] Saved mobile-web client storage state to ${storageStatePath}`);
});
