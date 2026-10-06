/**
 * Public landing page and sign-in dialog — unauthenticated visitor flow
 * (#1055, #1183).
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

test('/ is the landing page with the sign-in dialog closed', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('/login opens the sign-in dialog over the landing page', async ({ page }) => {
  await page.goto('/login');

  const dialog = page.getByRole('dialog', { name: 'Welcome back' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Email')).toBeFocused();
  await expect(dialog.getByLabel('Password')).toBeVisible();
  await expect(page.locator('h1')).toBeAttached();
});

test('the nav Sign in link opens the dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible();
});

test('Escape closes the dialog and returns to / with focus on Sign in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeFocused();
});

test('the close button closes the dialog and returns to /', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeFocused();
});

test('closing the dialog replaces history, so Back does not reopen it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goBack();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a logged-out visit to /clients lands on /login with the dialog open', async ({ page }) => {
  await page.goto('/clients');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible();
});

test('the section links smooth-scroll to their section and set the hash', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'How it works' }).click();

  await expect(page).toHaveURL(/#how-it-works$/);
  const section = page.locator('#how-it-works');
  await expect(section).toBeFocused();
  await expect(section).toBeInViewport();
});

test('the language switcher is in the header, not the footer', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('header').getByRole('group', { name: 'Language' })).toBeVisible();
  await expect(page.locator('footer').getByRole('group', { name: 'Language' })).toHaveCount(0);
});

// String bodies, like the init script above: the e2e tsconfig has no DOM lib.
const BODY_BACKGROUND = "getComputedStyle(document.body).backgroundColor";
const DARK_GROUND = 'rgb(14, 14, 15)';
const LIGHT_GROUND = 'rgb(255, 255, 255)';

test('the theme toggle switches to dark and the choice survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(await page.evaluate(BODY_BACKGROUND)).toBe(LIGHT_GROUND);

  await page.locator('header').getByRole('button', { name: 'Switch to dark' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(BODY_BACKGROUND)).toBe(DARK_GROUND);

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(BODY_BACKGROUND)).toBe(DARK_GROUND);
  await expect(page.locator('header').getByRole('button', { name: 'Switch to light' })).toBeVisible();
});

test('with the OS in dark mode and no stored choice the page is dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(await page.evaluate(BODY_BACKGROUND)).toBe(DARK_GROUND);
});

test('valid credentials navigate to /clients', async ({ page }) => {
  const password = requireSeedPassword();

  await page.goto('/login');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill(TRAINER_EMAIL);
  await dialog.getByLabel('Password').fill(password);
  await dialog.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/clients$/);
});

test('invalid credentials show an error and stay on /login', async ({ page }) => {
  await page.goto('/login');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill(TRAINER_EMAIL);
  await dialog.getByLabel('Password').fill('definitely-the-wrong-password');
  await dialog.getByRole('button', { name: 'Sign in' }).click();

  await expect(dialog.getByRole('alert')).toHaveText('Invalid email or password.');
  await expect(page).toHaveURL(/\/login$/);
  await expect(dialog).toBeVisible();
});
