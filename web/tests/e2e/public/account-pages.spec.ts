/**
 * Account-flow pages spanning multiple routes — the sign-in dialog routes
 * ("/login", "/register", "/forgot-password"), "/verify-email" and
 * "/auth/reset-password" — #1058 phase 4.
 *
 * Runs under the `public` project (playwright.config.ts) — no `setup`
 * dependency, no `storageState`, genuinely signed-out context, matching
 * entry.spec.ts.
 */
import { test, expect } from '@playwright/test';

// The app defaults to 'cs' when no 'lang' key exists in localStorage (see
// src/i18n/index.ts). Force English so this spec's text assertions are
// stable regardless of that default — mirrors entry.spec.ts.
test.beforeEach(async ({ page }) => {
  await page.addInitScript("window.localStorage.setItem('lang', 'en');");
});

test('/register and /forgot-password render their forms in the same dialog, each with an accessible name', async ({
  page,
}) => {
  await page.goto('/register');
  await expect(page.getByRole('dialog', { name: 'Create account' })).toBeVisible();

  await page.goto('/forgot-password');
  await expect(page.getByRole('dialog', { name: 'Forgot password' })).toBeVisible();
});

test('swapping between the form routes keeps one dialog mounted and focuses the container, never a field', async ({
  page,
}) => {
  // Regression: focusing the first field of RegisterForm (React Hook Form,
  // `mode: 'onTouched'`) made the user's next click blur it first, render its
  // "required" error, grow the form and swallow that click. On open, only
  // /login focuses a field (Email); /register and /forgot-password focus the
  // dialog container, and a client-side swap inside the open dialog must do
  // the same without closing and reopening it.
  await page.goto('/register');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeFocused();
  await expect(page.getByLabel('First name')).not.toBeFocused();

  const dialogHandle = await dialog.elementHandle();

  await dialog.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(dialog.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveCount(0);
  expect(await dialogHandle?.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.getByLabel('Email')).not.toBeFocused();

  await dialog.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(dialog).toBeFocused();
  await expect(page.getByLabel('First name')).not.toBeFocused();
  expect(await dialogHandle?.evaluate((node) => node.isConnected)).toBe(true);
});

test('the login form has no client app signpost', async ({ page }) => {
  // Reverses the #1058 AC 8 signpost: the sign-in board has none.
  await page.goto('/login');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Looking for a coach or nutritionist?')).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'App Store' })).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Google Play' })).toHaveCount(0);
  await expect(dialog.getByText('New to Form Up?')).toBeVisible();
});

test('/forgot-password returns the same confirmation copy for an existing and a non-existent address', async ({
  page,
  request,
}) => {
  // Regression / anti-enumeration (#656): RequestPasswordResetEndpoint
  // always returns 200 whether or not the account exists, and awaits the
  // email send SYNCHRONOUSLY (unlike registration's verification email,
  // which is queued) — so the UI must show identical confirmation copy for
  // both cases.
  //
  // Since #1059 the compose harness captures outbound mail in MailHog
  // instead of sending it for real, so any recipient address works here —
  // this no longer needs to be a real, deliverable inbox. Kept as a fixed
  // synthetic address purely so the "exists" case is a stable, reusable
  // account rather than a fresh one per run; registered here via a direct
  // API call (idempotent — a 400 "already registered" is fine, we only need
  // the account to exist).
  const existingEmail = 'existing-owner@example.com';
  await request.post('/auth/register', {
    data: {
      email: existingEmail,
      password: 'CorrectHorse9',
      confirmPassword: 'CorrectHorse9',
      firstName: 'Existing',
      lastName: 'Owner',
      roles: ['Trainer'],
      gdprConsent: true,
    },
  });

  // Straight apostrophe — matches the literal en.json string verbatim, not
  // a "smart quote" the source doesn't actually use.
  const sentCopy = "If an account exists for this address, we've sent it a password reset link.";

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(existingEmail);
  await page.getByRole('button', { name: 'Send link' }).click();
  // The "existing" case still awaits a real, synchronous outbound-mail call
  // (captured by MailHog rather than actually delivered, per #1059 — see the
  // comment above) — allow more than the default 5s.
  await expect(page.getByText(sentCopy)).toBeVisible({ timeout: 15_000 });

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('definitely-does-not-exist@example.com');
  await page.getByRole('button', { name: 'Send link' }).click();
  await expect(page.getByText(sentCopy)).toBeVisible();
});

test('/verify-email with no token and no session renders the invalid-link state and calls no /auth/ endpoint', async ({
  page,
}) => {
  // Regression: caller 3 (no token, no session) must never hit the API —
  // there is no email to verify against. A fresh, unauthenticated context
  // (no `refreshToken` in localStorage) makes restoreSession() short-circuit
  // without calling /auth/refresh either, so ANY /auth/ call here is a bug.
  const authCalls: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/auth/')) {
      authCalls.push(req.url());
    }
  });

  await page.goto('/verify-email');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: "This link isn't valid" })).toBeVisible();
  expect(authCalls).toEqual([]);
});

test('/verify-email?token=<bogus> calls /auth/verify-email exactly once', async ({ page }) => {
  // Regression: StrictMode double-invokes effects in dev. VerifyEmailEndpoint
  // CONSUMES the token (sets UsedAt) — a second call with the same token
  // would turn a real, successful verification into a false
  // INVALID_VERIFICATION_TOKEN failure. VerifyEmailPage guards this with a
  // never-reset `verifyStartedRef` latch (unlike LoginPanel's focus-guard
  // ref, which resets per navigation because it must fire once per swap).
  //
  // This spec also guards the page SETTLING at all. It was briefly disabled
  // because the page hung on "Verifying your email..." forever: the ref latch
  // survived StrictMode's remount (same component identity) but the
  // `useMutation` object did not, so the request belonged to the discarded
  // mount while the surviving one held a fresh mutation still sitting idle.
  // The latch correctly stopped the second, token-consuming call and, in
  // doing so, stopped the only thing that would have populated the component
  // left on screen. Fixed by moving to `useQuery`: the request and its result
  // live in the shared cache keyed by token, external to any one mount, so
  // both StrictMode mounts subscribe to the same entry. Assert BOTH halves —
  // one call (token safety) and a settled result (the user gets an answer) —
  // because the broken version satisfied the first on its own.

  const verifyCalls: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/auth/verify-email') {
      verifyCalls.push(req.url());
    }
  });

  await page.goto('/verify-email?token=definitely-bogus-token-1234');
  await page.waitForResponse((res) => res.url().includes('/auth/verify-email'));

  await expect(page.getByRole('heading', { name: "This link isn't valid" })).toBeVisible();
  expect(verifyCalls).toHaveLength(1);
});



test('/auth/reset-password with no query params renders the invalid-link state with no password inputs; with token+email it renders the form', async ({
  page,
}) => {
  // Regression: ResetPasswordPage reads `token` and `email` from the query
  // ONCE and gates on `!!token && emailIsWellFormed` — a missing/malformed
  // either one must render the invalid-link state immediately, WITHOUT
  // mounting the password form or calling the API. Token validity itself is
  // only ever checked server-side on submit (`ResetPasswordEndpoint`), so
  // any non-empty token value plus a syntactically valid email is enough to
  // render the form — a literally empty `?token=&email=` is indistinguishable
  // from "no query params" (`URLSearchParams.get` returns `''`, which is
  // falsy), so both must show the same invalid-link state.
  await page.goto('/auth/reset-password');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: "This link isn't valid" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);

  await page.goto('/auth/reset-password?token=&email=');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: "This link isn't valid" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);

  await page.goto('/auth/reset-password?token=some-reset-token-value&email=someone%40example.com');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(2);
});
