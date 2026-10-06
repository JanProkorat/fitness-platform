/**
 * Register form flows ("/register") — #1058 phase 4.
 *
 * Runs under the `public` project (playwright.config.ts) — no `setup`
 * dependency, no `storageState`, genuinely signed-out context, matching
 * entry.spec.ts. globalSetup's POST /test/reset still runs once before the
 * whole Playwright invocation, so the QA seed baseline (including
 * qa.trainer@fitnessplatform.test, used below as a known-duplicate email)
 * is guaranteed present.
 */
import { test, expect, type Page } from '@playwright/test';

const DUPLICATE_EMAIL = 'qa.trainer@fitnessplatform.test';
const VALID_PASSWORD = 'CorrectHorse9';

// The app defaults to 'cs' when no 'lang' key exists in localStorage (see
// src/i18n/index.ts). Force English so this spec's text assertions are
// stable regardless of that default — mirrors entry.spec.ts.
test.beforeEach(async ({ page }) => {
  await page.addInitScript("window.localStorage.setItem('lang', 'en');");
});

/**
 * A fresh, run-unique email per registration attempt. globalSetup resets the
 * DB once per Playwright *invocation*, not per spec — a hardcoded address
 * would collide with itself on a retry or a second local run against the
 * same still-up compose harness (design-review finding, #1058).
 */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

async function fillValidRegisterForm(
  page: import('@playwright/test').Page,
  email: string
): Promise<void> {
  await page.getByRole('button', { name: /^Trainer/ }).click();
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lovelace');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
}

// The dialog opens with a scale animation, which skews boundingBox() heights
// until it finishes — measure only once every animation has settled.
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate('Promise.all(document.getAnimations().map((animation) => animation.finished))');
}

test('/register deep-links straight to the register form, and the login<->register swap works by clicking', async ({
  page,
}) => {
  // Regression: EntryPage is a pathless layout route with routed children
  // swapped inside one dialog — a routing mismatch here would leave a cold
  // /register load stuck showing the login form.
  await page.goto('/register');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  await expect(page.getByLabel('First name')).toBeVisible();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(dialog.getByText('Welcome back')).toBeVisible();

  await dialog.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(dialog.getByText('Create account').first()).toBeVisible();
});

test('submit is disabled on an empty form and enables the instant consent is ticked, with no blur/Tab afterward', async ({
  page,
}) => {
  // Regression: the submit button used to stay locked until focus left the
  // consent checkbox — RHF's default 'onBlur' mode only revalidates on a
  // field's OWN blur, and the checkbox's change handler never fired one, so
  // ticking consent last (the natural order) never unlocked the button
  // without an extra, unnecessary Tab/click. Fixed by wiring field.onBlur on
  // every Controller field plus switching to 'onTouched' (#1058, three
  // rounds — see RegisterForm.tsx's `mode: 'onTouched'` comment).
  //
  // Interaction order below is the regression itself and must not change:
  // role -> names -> email -> password -> consent LAST, with NO blur, Tab,
  // or click after ticking consent. The button must already be enabled at
  // that exact point.
  await page.goto('/register');

  const submit = page.getByRole('button', { name: 'Create account' });
  await expect(submit).toBeDisabled();

  await fillValidRegisterForm(page, uniqueEmail('unlock-check'));
  await expect(submit).toBeDisabled();

  await page.getByRole('checkbox').check();

  await expect(submit).toBeEnabled();
});

test('arriving at /register via a client-side swap does not swallow the first click on the consent checkbox', async ({
  page,
}) => {
  // Regression (#1058 AC 15, round 2): the swap-focus logic used to focus
  // the register form's empty #entry-firstName field directly.
  // RegisterForm runs React Hook Form in `mode: 'onTouched'`, so the very
  // next click ANYWHERE blurred that never-typed field first — marking it
  // touched, rendering "Enter your first name.", growing the form ~24px,
  // and (via `self-center-safe`) re-centring the swap row out from under the
  // pointer between mousedown and mouseup, so the click never reached the
  // checkbox at all. A cold `page.goto('/register')` never focuses anything,
  // so it can't exercise this path — this MUST arrive via a real
  // client-side swap. Fixed by focusing the dialog container instead of any
  // field (see EntryPage.tsx's onOpenAutoFocus).
  await page.goto('/login');
  await page.getByRole('dialog').getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('First name')).toBeVisible();
  await settleAnimations(page);

  const form = page.locator('form');
  const before = await form.boundingBox();

  const consent = page.getByRole('checkbox');
  await consent.click();

  await expect(consent).toBeChecked();
  await expect(page.getByText('Enter your first name.')).not.toBeVisible();

  const after = await form.boundingBox();
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
});

test("a forced click on the disabled submit button does not change the register form's height", async ({
  page,
}) => {
  // Regression: RegisterForm's onSubmit handler guards `!isValid` specifically
  // to stop a submission forced past the disabled attribute from running
  // handleSubmit's full-schema validation, which would otherwise dump every
  // field's error at once and grow the form — the "six errors at once" bulk
  // dump this whole rework exists to prevent.
  await page.goto('/register');
  await settleAnimations(page);

  const form = page.locator('form');
  const before = await form.boundingBox();

  await page.getByRole('button', { name: 'Create account' }).click({ force: true });

  const after = await form.boundingBox();
  // toBeCloseTo, not toBe — getBoundingClientRect() has returned
  // sub-pixel-different floats (e.g. 560.5 vs 560.5000152587891) for an
  // otherwise visually identical layout; a whole extra error line would
  // move this by several pixels, so 1px of tolerance is still a real guard.
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
});

test('a successful registration reaches the check-your-email state, shows the address, and stays on /register', async ({
  page,
}) => {
  const email = uniqueEmail('register-success');

  await page.goto('/register');
  await fillValidRegisterForm(page, email);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('Check your email')).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('a duplicate email surfaces a localized message and never the raw "already taken" string', async ({
  page,
}) => {
  // Regression: RegisterEndpoint has no machine-readable code for a
  // duplicate email — it pipes ASP.NET Identity's raw English reason
  // ("Email 'x' is already taken.") straight through. RegisterForm must
  // pattern-match that reason and render a translated field error instead
  // of leaking the untranslated string into the DOM (design-review finding,
  // #1058).
  await page.goto('/register');
  await fillValidRegisterForm(page, DUPLICATE_EMAIL);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('This email is already registered.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('already taken');
});
