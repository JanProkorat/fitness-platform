/**
 * "Keep me signed in" storage choice and the logout controls on the pages a
 * client-only or unverified user is parked on. Runs under the `public`
 * project (no storageState), logging in through the real form.
 *
 * The refresh token key is 'refreshToken' (src/stores/auth.ts). Storage is
 * read with string expressions because tsconfig.e2e.json has no DOM lib.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

const TRAINER_EMAIL = 'qa.trainer@fitnessplatform.test';
const CLIENT_EMAIL = 'qa.client@fitnessplatform.test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript("window.localStorage.setItem('lang', 'en');");
});

function requireSeedPassword(): string {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  return password;
}

async function login(page: Page, email: string, keepSignedIn: boolean): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(requireSeedPassword());
  const keepSignedInBox = page.getByRole('checkbox', { name: 'Keep me signed in' });
  if (keepSignedIn) {
    await keepSignedInBox.check();
  } else {
    await keepSignedInBox.uncheck();
  }
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function readToken(page: Page, store: 'localStorage' | 'sessionStorage'): Promise<string | null> {
  return (await page.evaluate(`window.${store}.getItem('refreshToken')`)) as string | null;
}

test('unticked: refresh token lives only in sessionStorage, survives a reload and stays there after rotation', async ({
  page,
}) => {
  await login(page, TRAINER_EMAIL, false);
  await expect(page).toHaveURL(/\/clients$/);

  expect(await readToken(page, 'sessionStorage')).not.toBeNull();
  expect(await readToken(page, 'localStorage')).toBeNull();

  // Reload runs restoreSession, which refreshes (and rotates) the token.
  await page.reload();
  await expect(page).toHaveURL(/\/clients$/);
  expect(await readToken(page, 'sessionStorage')).not.toBeNull();
  expect(await readToken(page, 'localStorage')).toBeNull();
});

test('unticked: a new tab (fresh sessionStorage) is signed out', async ({ page, context }) => {
  await login(page, TRAINER_EMAIL, false);
  await expect(page).toHaveURL(/\/clients$/);

  const otherTab = await context.newPage();
  await otherTab.goto('/clients');
  await expect(otherTab).toHaveURL(/\/$/);
});

test('ticked: refresh token lives only in localStorage, survives a reload and stays there after rotation', async ({
  page,
  context,
}) => {
  await login(page, TRAINER_EMAIL, true);
  await expect(page).toHaveURL(/\/clients$/);

  expect(await readToken(page, 'localStorage')).not.toBeNull();
  expect(await readToken(page, 'sessionStorage')).toBeNull();

  await page.reload();
  await expect(page).toHaveURL(/\/clients$/);
  expect(await readToken(page, 'localStorage')).not.toBeNull();
  expect(await readToken(page, 'sessionStorage')).toBeNull();

  const otherTab = await context.newPage();
  await otherTab.goto('/clients');
  await expect(otherTab).toHaveURL(/\/clients$/);
});

test('/download-app offers a logout that clears both stores (client-only user)', async ({ page }) => {
  await login(page, CLIENT_EMAIL, false);
  await expect(page).toHaveURL(/\/download-app$/);

  await page.getByRole('button', { name: 'Log out' }).click();

  await expect(page).toHaveURL(/\/$/);
  expect(await readToken(page, 'sessionStorage')).toBeNull();
  expect(await readToken(page, 'localStorage')).toBeNull();
});

test('the unverified-session /verify-email state offers a logout', async ({ page }) => {
  // Real login, then /users/me reports an unconfirmed email so ProtectedRoute
  // parks the session on /verify-email.
  await page.route(
    (url) => url.pathname === '/users/me',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'aaaaaaaa-0000-0000-0000-000000000002',
          email: TRAINER_EMAIL,
          firstName: 'QA',
          lastName: 'Trainer',
          roles: ['Trainer'],
          emailConfirmed: false,
        }),
      }),
  );

  await login(page, TRAINER_EMAIL, true);
  await expect(page).toHaveURL(/\/verify-email$/);

  await page.getByRole('button', { name: 'Log out' }).click();

  await expect(page).toHaveURL(/\/$/);
  expect(await readToken(page, 'localStorage')).toBeNull();
  expect(await readToken(page, 'sessionStorage')).toBeNull();
});
