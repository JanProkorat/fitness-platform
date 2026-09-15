/**
 * Public entry page ("/") — unauthenticated visitor flow (#1055).
 *
 * Runs under the `public` project (playwright.config.ts) — no `setup`
 * dependency, no `storageState`, so the browser context starts genuinely
 * signed out. Credentials come from QA_SEED_PASSWORD against the seeded
 * `qa.trainer@fitnessplatform.test` fixture (QaSeedRunner), same as
 * tests/e2e/auth.setup.ts.
 */
import { test, expect } from '@playwright/test';

const TRAINER_EMAIL = 'qa.trainer@fitnessplatform.test';

// The app defaults to 'cs' when no 'lang' key exists in localStorage (see
// src/i18n/index.ts). Force English so this spec's text assertions are
// stable regardless of that default — mirrors auth.setup.ts's storage state
// for the other role-scoped projects.
test.beforeEach(async ({ page }) => {
  // A string body (not a TS function) — tsconfig.e2e.json has no "DOM" lib,
  // so a real function referencing `window`/`localStorage` would not
  // type-check here even though it runs fine in the browser context.
  await page.addInitScript("window.localStorage.setItem('lang', 'en');");
});

function requireSeedPassword(): string {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error(
      'QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test, fill it in, ' +
        'then source it or load it with dotenv before running Playwright.',
    );
  }
  return password;
}

test('unauthenticated visitor sees the entry page at /', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('valid credentials navigate to /clients', async ({ page }) => {
  const password = requireSeedPassword();

  await page.goto('/');
  await page.getByLabel('Email').fill(TRAINER_EMAIL);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/clients$/);
});

test('invalid credentials show an error and stay on /', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(TRAINER_EMAIL);
  await page.getByLabel('Password').fill('definitely-the-wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
  await expect(page).toHaveURL(/\/$/);
});
