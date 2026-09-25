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
    // "No messages" was the QA seed fixture's one non-zero non-"All" chip
    // pre-#1095. It reads 0 on this tab now: #1095 seeded a NEW third
    // client (qa.client3, no conversation, no active plan) specifically to
    // keep this chip populated, but a plan-less live-linked client is
    // classified Paused (ClientStatusClassifier.Classify — #1094), not
    // Active, so it doesn't appear on this page's default Active tab at
    // all (it's on the Paused tab; see inbox.spec.ts's filter-parity test,
    // which unions Active+Paused to match the inbox's tab-independent
    // roster and finds it there). "Unread messages" is the chip #1095
    // actually left non-zero on the Active tab — the original QA Client
    // now has a seeded conversation with one unread message.
    const unreadMessagesChip = page.getByRole('button', { name: /Unread messages/ });
    await unreadMessagesChip.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/chip=UnreadMessages/);
    await expect(unreadMessagesChip).toHaveAttribute('aria-pressed', 'true');
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
   * #1109 — inviting a coach's own email (Trainer or Nutritionist account)
   * 400s with INVITEE_IS_PROFESSIONAL. The drawer stays open (unchanged
   * default for any error) and now additionally renders the message inline
   * with role="alert", since a screen reader won't reliably announce a
   * toast raised while the drawer holds focus. The toast still fires too —
   * this test also proves the companion z-index fix (toast viewport now
   * above every overlay, see the --z-toast comment in index.css) by
   * asserting the toast actually receives pointer events rather than being
   * visually covered by the still-open drawer.
   *
   * qa.nutri@fitnessplatform.test is the seeded Nutritionist
   * (docs/testing/e2e-fixtures.md:54) — a coach account, not a self-invite,
   * so this attempt saves nothing and stays idempotent across re-runs. Kept
   * to a single invite attempt: pending-invite creation is rate-limited to
   * 30 per 15 minutes per trainer (Program.cs:178-188).
   */
  test('inviting a coach email shows an inline alert and keeps the toast clickable above the open drawer (#1109)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '+ Invite client' }).click();
    await expect(page.getByRole('heading', { name: 'Invite a new client' })).toBeVisible();

    await page.getByLabel('Email').fill('qa.nutri@fitnessplatform.test');
    await page.getByLabel('Email').press('Tab');

    const submitButton = page.getByRole('button', { name: 'Send invitation' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Drawer stays open — the inline alert renders next to the email field.
    // Radix's Toast doesn't set role="alert" (it announces via its own
    // aria-live region, not this attribute), so this locator only ever
    // matches the drawer's own inline error, not the toast below.
    await expect(page.getByRole('heading', { name: 'Invite a new client' })).toBeVisible();
    const inlineAlert = page.getByRole('alert');
    await expect(inlineAlert).toHaveText('This email belongs to a coach account. You can only invite clients.');

    // The same message is also raised as a toast (unchanged from today's
    // behaviour for every other error) — scoped to the toast root via its
    // data-slot so it can't match the inline alert above, which carries the
    // identical text. `click({ trial: true })` runs Playwright's full
    // actionability check (visible, stable, receives pointer events)
    // without performing the click, so it fails if the still-open drawer
    // covers the toast.
    const toast = page
      .locator("[data-slot='toast']")
      .filter({ hasText: 'This email belongs to a coach account. You can only invite clients.' });
    await expect(toast).toBeVisible();
    await toast.click({ trial: true });
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

  /**
   * #1091 — the plans-column popup had its content inverted relative to the
   * wireframe: the plan name rendered bold on line 1 with the type conveyed
   * only by an icon, and never as text. Restructured to a header (avatar +
   * full name + active-plan count) followed by one block per plan: the bold
   * type label with the start date right-aligned on line 1, the muted plan
   * name demoted to line 2. The QA seed's trainer link grants
   * CanViewTrainingPlans only (CanViewNutritionPlans is false), so the
   * fixture client "QA Client" surfaces exactly one training plan.
   */
  test('the plans popup states the plan type as text and demotes the name to line 2 (#1091)', async ({ page }) => {
    const trigger = page.getByRole('button', { name: '1 active plan' });
    await trigger.hover();

    const card = page.locator("[data-slot='hover-card-content']");
    await expect(card).toBeVisible();

    await expect(card.getByText('QA Client', { exact: false })).toBeVisible();
    await expect(card.getByText('Training', { exact: true })).toBeVisible();
    await expect(card.getByText('1 active plan', { exact: true })).toBeVisible();
    await expect(card.getByText('QA Test Plan — ForTime fixture', { exact: false })).toBeVisible();
    await expect(card.getByText('Since', { exact: false })).toHaveCount(0);
  });
});
