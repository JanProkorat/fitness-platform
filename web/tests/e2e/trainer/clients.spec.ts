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
    await page.getByLabel('First name').fill('QA');
    await page.getByLabel('Last name').fill(`Invite${uniqueSuffix}`);
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
});
