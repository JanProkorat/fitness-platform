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

    /**
     * #1081 — the drawer's slide/fade was expressed as a CSS *transition*,
     * which Radix's Presence (@radix-ui/react-presence) can't animate: a
     * transition has no `animationName`, so `getAnimationName()` returns
     * "none" and Presence unmounts the element on the SAME tick the close
     * is triggered — open never animated either, because a transition
     * needs a previous value and Radix mounts the element already in its
     * final state. Fixed by expressing both states as `@keyframes`, with a
     * DISTINCT keyframe name per direction (Presence gates the exit on
     * `prevAnimationName !== currentAnimationName`, so a single keyframe
     * reused via `animation-direction: reverse` still computes to the same
     * name and still unmounts instantly).
     */
    test('the drawer content and overlay animate with distinct enter/exit keyframes and suspend removal on close (#1081)', async ({
      page,
    }) => {
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Open navigation' }).click();

      const dialog = page.getByRole('dialog');
      const overlay = page.locator("[data-slot='sheet-overlay']");
      await expect(dialog).toBeVisible();

      // A. CSS contract. `animation-name` persists in computed style after
      // the animation ends, so this is not a transient assertion.
      await expect(dialog).toHaveCSS('animation-name', 'sheet-in-left');
      await expect(overlay).toHaveCSS('animation-name', 'sheet-overlay-in');
      const enterContentName = await dialog.evaluate((el) => getComputedStyle(el).animationName);
      const enterOverlayName = await overlay.evaluate((el) => getComputedStyle(el).animationName);

      await dialog.getByRole('button', { name: 'Close' }).click();

      // B. Exit suspension — the actual regression test. Before the fix
      // this assertion failed: the element was already gone (unmounted on
      // the same tick as the click) by the time Playwright could observe
      // it, because there was no real CSS animation to suspend the removal
      // on.
      await expect(dialog).toHaveAttribute('data-state', 'closed');
      await expect(dialog).toHaveCSS('animation-name', 'sheet-out-left');
      await expect(overlay).toHaveCSS('animation-name', 'sheet-overlay-out');
      const exitContentName = await dialog.evaluate((el) => getComputedStyle(el).animationName);
      const exitOverlayName = await overlay.evaluate((el) => getComputedStyle(el).animationName);
      expect(exitContentName).not.toBe(enterContentName);
      expect(exitOverlayName).not.toBe(enterOverlayName);

      await expect(dialog).toBeHidden();
    });
  });
});
