/**
 * #1073 — app shell responsive behaviour, across all four v1 routes.
 *
 * shell.smoke.spec.ts (out of scope for #1073, must pass unmodified) already
 * proves the desktop shell renders and routes; this spec covers what that
 * one doesn't:
 *   1. All four v1 routes — not just /clients and /inbox — at desktop width.
 *   2. No route scrolls horizontally at ~390px (#1066 regression guard).
 *   3. The off-canvas drawer, opened from the hamburger trigger that now
 *      lives inside <main> (the top bar it used to live in is gone), still
 *      exposes the nav and a reachable logout control.
 *
 * Below `lg`, the static sidebar stays mounted (`hidden lg:flex` is
 * display:none, not unmount) while the drawer's own Sidebar copy renders
 * once open — see docs/design/1073/shell-inventory.md #6. An unscoped
 * `getByText` would resolve two matches once both exist, so every assertion
 * inside the drawer test below is scoped to `page.getByRole('dialog')`.
 */
import { trainerTest as test, expect } from '../fixtures/auth';

const ROUTES = [
  { path: '/clients', heading: 'Clients' },
  { path: '/inbox', heading: 'Inbox' },
  { path: '/recipes', heading: 'Recipes' },
  { path: '/ingredients', heading: 'Ingredients' },
];

test.describe('app shell responsive behaviour', () => {
  test.describe('desktop', () => {
    for (const { path, heading } of ROUTES) {
      test(`${path} renders the static sidebar and page heading`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('heading', { name: heading })).toBeVisible();

        const nav = page.getByRole('navigation');
        await expect(nav.getByText('Clients', { exact: true })).toBeVisible();
        await expect(nav.getByText('Inbox', { exact: true })).toBeVisible();
        await expect(nav.getByText('Recipes', { exact: true })).toBeVisible();
        await expect(nav.getByText('Ingredients', { exact: true })).toBeVisible();
      });
    }
  });

  test.describe('390px', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    for (const { path } of ROUTES) {
      test(`${path} has no horizontal overflow`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));

        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      });
    }

    test('the off-canvas drawer opens from the hamburger and exposes the nav plus logout', async ({
      page,
    }) => {
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Open navigation' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Clients', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Inbox', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Recipes', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Ingredients', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Log out' })).toBeVisible();
    });
  });
});
