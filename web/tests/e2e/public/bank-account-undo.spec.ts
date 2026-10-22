/**
 * "/bank-account/undo" — the page behind the link in the bank-account-change email.
 *
 * Runs under the `public` project (no session). The undo endpoint is mocked with `page.route`, so
 * the spec checks the page's own contract and needs no payments proxy or seeded bank account:
 * nothing is sent on load, the token leaves the address bar, one click sends exactly one request,
 * and the two documented refusals map to their own cards.
 */
import { test, expect } from '@playwright/test';

const UNDO_ROUTE = '**/payments/bank-account/undo';

test.beforeEach(async ({ page }) => {
  await page.addInitScript("window.localStorage.setItem('lang', 'en');");
});

test('the undo link acts only on an explicit click, once, and leaves no token in the address bar', async ({
  page,
}) => {
  const bodies: string[] = [];
  await page.route(UNDO_ROUTE, async (route) => {
    bodies.push(route.request().postData() ?? '');
    await route.fulfill({ status: 204 });
  });

  // A token with characters that URL decoding must hand over verbatim.
  await page.goto('/bank-account/undo?token=tok%2Fen%3D');

  const undoButton = page.getByRole('button', { name: 'Undo change' });
  await expect(undoButton).toBeVisible();
  await expect(page).toHaveURL(/\/bank-account\/undo$/);
  expect(bodies).toHaveLength(0);

  await undoButton.click();
  await expect(page.getByRole('heading', { name: 'Previous account restored' })).toBeVisible();

  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0])).toEqual({ token: 'tok/en=' });
});

test('an expired link and a superseded change each get their own card', async ({ page }) => {
  await page.route(UNDO_ROUTE, async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/problem+json',
      body: JSON.stringify({ errors: [{ name: 'generalErrors', reason: 'expired', code: 'BANK_ACCOUNT_UNDO_INVALID' }] }),
    });
  });
  await page.goto('/bank-account/undo?token=expired');
  await page.getByRole('button', { name: 'Undo change' }).click();
  await expect(page.getByRole('heading', { name: 'This link no longer works' })).toBeVisible();

  await page.unroute(UNDO_ROUTE);
  await page.route(UNDO_ROUTE, async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 409, errorCode: 'BANK_ACCOUNT_UNDO_SUPERSEDED' }),
    });
  });
  await page.goto('/bank-account/undo?token=superseded');
  await page.getByRole('button', { name: 'Undo change' }).click();
  await expect(page.getByRole('heading', { name: 'The account changed again' })).toBeVisible();
});
