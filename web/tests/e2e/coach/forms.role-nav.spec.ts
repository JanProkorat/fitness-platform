/**
 * #1341 — Forms is open to both coach roles: the sidebar shows the Forms item
 * and /forms renders for a trainer-only and a nutritionist-only user. The
 * trainer block also drives create, the Type filter and delete end to end.
 */
import { trainerTest, nutritionistTest, expect } from '../fixtures/auth';
import type { Page } from '@playwright/test';

async function expectFormsPage(page: Page) {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');

  const nav = page.getByRole('navigation');
  await expect(nav.getByText('Forms', { exact: true }).first()).toBeVisible();
  await nav.getByRole('link', { name: 'Forms' }).click();

  await expect(page).toHaveURL(/\/forms$/);
  await expect(page.getByRole('heading', { name: 'Forms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New form' }).first()).toBeVisible();
}

nutritionistTest.describe('nutritionist forms nav', () => {
  nutritionistTest('sidebar links to /forms and the page renders', async ({ page }) => {
    await expectFormsPage(page);
  });
});

trainerTest.describe('trainer forms', () => {
  trainerTest('sidebar links to /forms and the page renders', async ({ page }) => {
    await expectFormsPage(page);
  });

  trainerTest('create, filter by type and delete a form', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const onboardingName = `E2E onboarding ${suffix}`;
    const checkInName = `E2E check-in ${suffix}`;

    async function createForm(name: string, typeLabel: 'Onboarding' | 'Check-in') {
      await page.goto('/forms');
      await page.getByRole('button', { name: 'New form' }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByRole('radio', { name: new RegExp(typeLabel) }).click();
      await dialog.getByRole('button', { name: 'Create form' }).click();
      // The builder route lands in a later task; creating the form is what counts here.
      await expect(page).toHaveURL(/\/forms\/[0-9a-f-]{36}$/);
    }

    await createForm(onboardingName, 'Onboarding');
    await createForm(checkInName, 'Check-in');

    await page.goto('/forms');
    await page.getByRole('searchbox', { name: 'Search forms…' }).fill(`E2E `);
    const onboardingRow = page.getByRole('row').filter({ hasText: onboardingName });
    const checkInRow = page.getByRole('row').filter({ hasText: checkInName });
    await expect(onboardingRow).toBeVisible();
    await expect(checkInRow).toBeVisible();

    await page.getByRole('button', { name: 'Type' }).click();
    await page.getByRole('option', { name: 'Check-in' }).click();
    await expect(page).toHaveURL(/type=CheckIn/);
    await expect(checkInRow).toBeVisible();
    await expect(onboardingRow).toHaveCount(0);

    for (const name of [onboardingName, checkInName]) {
      await page.goto('/forms');
      await page.getByRole('searchbox', { name: 'Search forms…' }).fill(name);
      await page.getByRole('button', { name: `Actions for ${name}` }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);
    }
  });
});
