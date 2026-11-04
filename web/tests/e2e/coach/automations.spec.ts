/**
 * Automations is open to both coach roles: the Forms section of the sidebar links to
 * /automations and the page renders for a trainer-only and a nutritionist-only user.
 * The trainer block also drives a schedule rule through create, edit, toggle and delete.
 */
import { trainerTest, nutritionistTest, expect } from '../fixtures/auth';
import type { Page } from '@playwright/test';
import { ensureCheckInRule } from '../fixtures/check-in-rule';

async function expectAutomationsPage(page: Page) {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');

  const nav = page.getByRole('navigation');
  await expect(nav.getByText('Automations', { exact: true }).first()).toBeVisible();
  await nav.getByRole('link', { name: 'Automations' }).click();

  await expect(page).toHaveURL(/\/automations$/);
  await expect(page.getByRole('heading', { name: 'Automations', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New rule' }).first()).toBeVisible();
}

nutritionistTest.describe('nutritionist automations nav', () => {
  nutritionistTest('sidebar links to /automations and the page renders', async ({ page }) => {
    await expectAutomationsPage(page);
  });
});

trainerTest.describe('trainer automations', () => {
  trainerTest('sidebar links to /automations and the page renders', async ({ page }) => {
    await expectAutomationsPage(page);
  });

  trainerTest('create, edit, toggle and delete a schedule rule', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const name = `E2E measurements ${suffix}`;
    const renamed = `E2E measurements renamed ${suffix}`;

    await page.goto('/automations');
    await page.getByRole('button', { name: 'New rule' }).first().click();
    const drawer = page.getByRole('dialog');
    await drawer.getByLabel('Name', { exact: true }).fill(name);
    await drawer.getByRole('button', { name: 'Request measurements' }).click();
    await drawer.getByLabel('Every', { exact: true }).fill('2');
    await drawer.getByRole('button', { name: 'Save rule' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: name })).toContainText('Every 2 weeks');

    // Edit: rename through the row's name button.
    await page.getByRole('button', { name, exact: true }).click();
    const editDrawer = page.getByRole('dialog');
    await expect(editDrawer.getByLabel('Name', { exact: true })).toHaveValue(name);
    await editDrawer.getByLabel('Name', { exact: true }).fill(renamed);
    await editDrawer.getByRole('button', { name: 'Save rule' }).click();
    await expect(editDrawer).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: renamed })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);

    // Toggle off, then on again; the list refetches after each PUT.
    const toggle = page.getByRole('switch', { name: `Enable rule “${renamed}”` });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();

    // Delete.
    await page.getByRole('button', { name: `Actions for ${renamed}` }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete rule' }).click();
    await expect(page.getByRole('row').filter({ hasText: renamed })).toHaveCount(0);
  });

  trainerTest('the weekly check-in is an ordinary rule: it has a switch, no Linked marker, and a changed weekday survives a reload', async ({
    page,
    baseURL,
  }) => {
    const rule = await ensureCheckInRule(baseURL ?? 'http://localhost:5173');
    try {
      await page.goto('/automations');
      const row = page.getByRole('row').filter({ hasText: rule.name });
      await expect(row).toBeVisible();
      await expect(row).toContainText('Every Monday, 18:00');
      await expect(page.getByText('Linked', { exact: true })).toHaveCount(0);

      // The switch flips off and on again.
      const toggle = page.getByRole('switch', { name: `Enable rule “${rule.name}”` });
      await expect(toggle).toBeChecked();
      await toggle.click();
      await expect(toggle).not.toBeChecked();
      await toggle.click();
      await expect(toggle).toBeChecked();

      // Change the weekday in the drawer; the new day is still there after a reload.
      await page.getByRole('button', { name: rule.name, exact: true }).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer.getByRole('button', { name: 'Mon', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await drawer.getByRole('button', { name: 'Thu', exact: true }).click();
      await drawer.getByRole('button', { name: 'Save rule' }).click();
      await expect(drawer).toBeHidden();

      await page.reload();
      await expect(row).toContainText('Every Thursday, 18:00');
    } finally {
      await rule.restore();
    }
  });
});
