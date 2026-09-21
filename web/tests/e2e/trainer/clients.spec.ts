/**
 * #1066 — Clients list page regression smoke (tab switch, a filter chip, the
 * invite flow). Path is deliberately under trainer/ — every project in
 * playwright.config.ts matches a role subfolder via testMatch, so a spec at
 * the e2e/ root is collected by no project and silently never runs (see
 * PLAN-1066-clients-page.md §1).
 *
 * Imports `trainerTest`, not the bare `test`: the trainer project
 * deliberately carries no `storageState` (#897), so a spec using the bare
 * `test` export lands on the login page and asserts against the marketing
 * page instead of the authenticated portal.
 */
import { trainerTest as test, expect } from '../fixtures/auth';

test.describe('clients list page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  });

  test('switching tabs updates the URL and the active tab', async ({ page }) => {
    const pausedTab = page.getByRole('tab', { name: /Paused/ });
    await pausedTab.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/tab=Paused/);
    await expect(pausedTab).toHaveAttribute('data-state', 'active');

    // Table settles into either rows or the empty state — never stuck loading.
    await expect(page.getByText('Loading', { exact: false })).toHaveCount(0);
  });

  test('selecting a filter chip updates the URL and marks the chip active', async ({ page }) => {
    // "No messages" is the QA seed fixture's one non-zero non-"All" chip
    // (the single seeded client has no unread messages) — the others start
    // disabled at count 0, so this is the one chip guaranteed clickable
    // against the deterministic seed baseline.
    const noMessagesChip = page.getByRole('button', { name: /No messages/ });
    await noMessagesChip.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/chip=NoMessages/);
    await expect(noMessagesChip).toHaveAttribute('aria-pressed', 'true');
  });

  test('inviting a new client sends the invite and closes the drawer', async ({ page }) => {
    await page.getByRole('button', { name: '+ Invite client' }).click();
    await expect(page.getByRole('heading', { name: 'Invite a new client' })).toBeVisible();

    const uniqueSuffix = Date.now();
    await page.getByLabel('Email').fill(`qa.invite.${uniqueSuffix}@fitnessplatform.test`);
    await page.getByLabel('Email').press('Tab');

    const submitButton = page.getByRole('button', { name: 'Send invitation' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Radix's Toast primitive renders a visible title plus a duplicate
    // aria-live announcer span — scope to the visible title so this doesn't
    // hit a strict-mode "resolved to 2 elements" violation.
    await expect(page.getByText('Invitation sent.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Invite a new client' })).not.toBeVisible();
  });

  /**
   * #1079 — the type scale declared font sizes with no paired line-heights,
   * so every control wrapped around a line of text came out ~25% taller
   * than the wireframe. Measured, not eyeballed: a height assertion catches
   * the pairing silently regressing back to the browser's unpaired
   * `normal` line-height, which a visual/eyeball check would not.
   */
  test('control heights match the wireframe at 1920px (#1079)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const activeTab = page.getByRole('tab', { name: /Active/ });
    await expect(activeTab).toBeVisible();
    const tabHeight = (await activeTab.boundingBox())?.height ?? 0;
    expect(tabHeight).toBeGreaterThan(27);
    expect(tabHeight).toBeLessThan(31);

    const searchBox = page.getByPlaceholder('Search clients...');
    await expect(searchBox).toBeVisible();
    const searchHeight = (await searchBox.boundingBox())?.height ?? 0;
    expect(searchHeight).toBeGreaterThan(30);
    expect(searchHeight).toBeLessThan(34);

    const navSectionHeader = page.getByText('Client management', { exact: true });
    await expect(navSectionHeader).toBeVisible();
    const navHeaderHeight = (await navSectionHeader.boundingBox())?.height ?? 0;
    expect(navHeaderHeight).toBeGreaterThan(10);
    expect(navHeaderHeight).toBeLessThan(14);

    const pageTitle = page.getByRole('heading', { name: 'Clients' });
    const pageTitleHeight = (await pageTitle.boundingBox())?.height ?? 0;
    expect(pageTitleHeight).toBeGreaterThan(32);
    expect(pageTitleHeight).toBeLessThan(36);

    const allChip = page.getByRole('button', { name: /\bAll$/ });
    const countBadge = allChip.locator('span').first();
    await expect(countBadge).toBeVisible();
    const badgeBox = await countBadge.boundingBox();
    expect(badgeBox?.height ?? 0).toBeGreaterThan(14);
    expect(badgeBox?.height ?? 0).toBeLessThan(18);
    expect(badgeBox?.width ?? 0).toBeGreaterThan(badgeBox?.height ?? 0);
  });

  /**
   * #1081 — the "add client" drawer covers the default `side="right"`
   * case (the off-canvas nav drawer in shell.responsive.spec.ts covers
   * `side="left"`). See that spec's matching test for the full root-cause
   * comment on why a CSS transition can't drive Radix's Presence.
   */
  test('the add-client drawer content and overlay animate with distinct enter/exit keyframes and suspend removal on close (#1081)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '+ Invite client' }).click();
    await expect(page.getByRole('heading', { name: 'Invite a new client' })).toBeVisible();

    const dialog = page.getByRole('dialog');
    const overlay = page.locator("[data-slot='sheet-overlay']");

    // A. CSS contract.
    await expect(dialog).toHaveCSS('animation-name', 'sheet-in-right');
    await expect(overlay).toHaveCSS('animation-name', 'sheet-overlay-in');
    const enterContentName = await dialog.evaluate((el) => getComputedStyle(el).animationName);
    const enterOverlayName = await overlay.evaluate((el) => getComputedStyle(el).animationName);

    await dialog.getByRole('button', { name: 'Close' }).click();

    // B. Exit suspension — the actual regression test.
    await expect(dialog).toHaveAttribute('data-state', 'closed');
    await expect(dialog).toHaveCSS('animation-name', 'sheet-out-right');
    await expect(overlay).toHaveCSS('animation-name', 'sheet-overlay-out');
    const exitContentName = await dialog.evaluate((el) => getComputedStyle(el).animationName);
    const exitOverlayName = await overlay.evaluate((el) => getComputedStyle(el).animationName);
    expect(exitContentName).not.toBe(enterContentName);
    expect(exitOverlayName).not.toBe(enterOverlayName);

    await expect(dialog).toBeHidden();
  });
});
