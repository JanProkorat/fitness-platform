/**
 * Account-flow pages spanning multiple routes — the panel layout
 * ("/", "/register", "/forgot-password"), "/verify-email" and
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

test('the panel headline does not move across /, /register and /forgot-password', async ({ page }) => {
  // Regression: LoginPanel's headline and the form swap area used to share
  // one centred flex column, so the headline drifted up/down every time the
  // active form's height changed. Fixed by pinning the headline to its own
  // `auto` grid row, sibling to the swap area (#1058 phase 1). Each page
  // load below is a full navigation (not a client-side swap), so there is
  // no cross-fade in play — this isolates the assertion to layout, not
  // animation timing.
  const headline = page.getByRole('heading', {
    name: 'Join our community of coaches and nutritionists',
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const loginBox = await headline.boundingBox();

  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  const registerBox = await headline.boundingBox();

  await page.goto('/forgot-password');
  await page.waitForLoadState('networkidle');
  const forgotBox = await headline.boundingBox();

  expect(loginBox).not.toBeNull();
  expect(registerBox?.y).toBe(loginBox?.y);
  expect(forgotBox?.y).toBe(loginBox?.y);
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
  // IMPORTANT: the compose harness talks to the LIVE Resend service, which
  // rejects any recipient other than the account owner and 500s the
  // request. Any "existing account" email other than prokoratj@gmail.com
  // will fail at the email provider, not in our code — this is not a
  // backend bug, don't spend time chasing it. Use prokoratj@gmail.com as
  // the "exists" case, registered here via a direct API call (idempotent —
  // a 400 "already registered" is fine, we only need the account to exist).
  const existingEmail = 'prokoratj@gmail.com';
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
  // The "existing" case awaits a real, synchronous call to the live email
  // provider (see the comment above) — allow more than the default 5s.
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

test('a client-side login<->register swap focuses the new form\'s first field, but a cold load never steals focus', async ({
  page,
}) => {
  // Regression (#1058 AC 15): LoginPanel's focus effect reset its own
  // "already focused" guard inside a cleanup function. React runs an
  // effect's cleanup before EVERY re-run triggered by a dependency change,
  // not only on unmount, so the guard re-armed on every single swap and the
  // effect's `.focus()` call was unreachable dead code — confirmed via
  // `document.activeElement` staying BODY at +0..+2500ms after a real swap.
  // Fixed with a ref that remembers the last `display.key` the effect
  // already handled, seeded with the mount's own key (see LoginPanel.tsx's
  // `focusedKeyRef`). Both halves matter: a cold load must NOT steal focus,
  // and a real swap MUST move it.
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await expect(page.getByLabel('Email')).not.toBeFocused();

  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await expect(page.getByLabel('First name')).not.toBeFocused();

  // Real client-side swap back to login — focus MUST move to the first field.
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Email')).toBeFocused();

  // And swapping forward to register again — same expectation.
  await page.getByRole('link', { name: 'Create a coach account' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('First name')).toBeFocused();
});

test('the client signpost renders on the login form only, not on register or forgot-password', async ({
  page,
}) => {
  // Regression (#1058 AC 8): the "looking for a coach or nutritionist?"
  // signpost + App Store/Google Play buttons were approved in prototype
  // review (twice — first to add it, then to restrict it to the login form)
  // but never built. Asserts both presence on login AND absence on the
  // other two forms, which was the explicit product decision.
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Looking for a coach or nutritionist?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'App Store' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google Play' })).toBeVisible();

  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Looking for a coach or nutritionist?')).toHaveCount(0);

  await page.goto('/forgot-password');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Looking for a coach or nutritionist?')).toHaveCount(0);
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
