/**
 * "/email-off" — the page behind the turn-off link in notification emails.
 *
 * Runs under the `public` project (no session). Both endpoints are mocked with `page.route`, so the
 * spec checks the page's own contract: one turn-off POST on load, the token leaves the address bar,
 * "Turn back on" sends the same token once, and any 400 or a missing token gets the "doesn't work" card.
 */
import { test, expect } from '@playwright/test';

const TURN_OFF_ROUTE = '**/users/email-links/turn-off';
const TURN_ON_ROUTE = '**/users/email-links/turn-on';

test.beforeEach(async ({ page }) => {
  await page.addInitScript("window.localStorage.setItem('lang', 'en');");
});

test('the link turns the email off once, hides the token, and can turn it back on', async ({ page }) => {
  const offBodies: string[] = [];
  const onBodies: string[] = [];
  await page.route(TURN_OFF_ROUTE, async (route) => {
    offBodies.push(route.request().postData() ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'coach@example.com', event: 'NewMessage' }),
    });
  });
  await page.route(TURN_ON_ROUTE, async (route) => {
    onBodies.push(route.request().postData() ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'coach@example.com', event: 'NewMessage' }),
    });
  });

  await page.goto('/email-off?token=tok%2Fen%3D');

  await expect(page.getByRole('heading', { name: 'This email is off' })).toBeVisible();
  await expect(page.getByText('coach@example.com')).toBeVisible();
  await expect(page.getByText('New message', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/email-off$/);
  expect(offBodies).toHaveLength(1);
  expect(JSON.parse(offBodies[0])).toEqual({ token: 'tok/en=' });

  await page.getByRole('button', { name: 'Turn back on' }).click();
  await expect(page.getByRole('heading', { name: 'This email is on again' })).toBeVisible();
  expect(onBodies).toHaveLength(1);
  expect(JSON.parse(onBodies[0])).toEqual({ token: 'tok/en=' });
  expect(offBodies).toHaveLength(1);
});

test('a 400 from the API shows the "doesn\'t work" card', async ({ page }) => {
  await page.route(TURN_OFF_ROUTE, async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/problem+json',
      body: JSON.stringify({ errors: [{ name: 'generalErrors', reason: 'invalid', code: 'EMAIL_LINK_INVALID' }] }),
    });
  });
  await page.goto('/email-off?token=tampered');
  await expect(page.getByRole('heading', { name: "This link doesn't work" })).toBeVisible();
});

test('a link without a token shows the "doesn\'t work" card and sends nothing', async ({ page }) => {
  let requests = 0;
  await page.route(TURN_OFF_ROUTE, async (route) => {
    requests += 1;
    await route.abort();
  });
  await page.goto('/email-off');
  await expect(page.getByRole('heading', { name: "This link doesn't work" })).toBeVisible();
  expect(requests).toBe(0);
});
