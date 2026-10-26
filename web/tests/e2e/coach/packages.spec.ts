/**
 * Packages and discounts: a coach creates, edits and archives a package, then creates a
 * discount limited to a second package. The archived package is not offered in the picker.
 */
import { trainerTest, expect } from '../fixtures/auth';

trainerTest.describe('trainer packages and discounts', () => {
  trainerTest('create, edit and archive a package, then a discount limited to another', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const archivedName = `E2E package old ${suffix}`;
    const keptName = `E2E package kept ${suffix}`;
    const discountName = `E2E discount ${suffix}`;

    await page.goto('/clients');
    await page.getByRole('navigation').getByRole('link', { name: 'Packages' }).click();
    await expect(page).toHaveURL(/\/packages$/);
    await expect(page.getByRole('heading', { name: 'Packages', exact: true })).toBeVisible();

    // Create.
    await page.getByRole('button', { name: 'New package' }).click();
    const drawer = page.getByRole('dialog');
    await drawer.getByLabel('Name', { exact: true }).fill(archivedName);
    await drawer.getByLabel('Price', { exact: true }).fill('1500');
    await drawer.getByRole('button', { name: 'Save package' }).click();
    await expect(drawer).toBeHidden();
    const archivedRow = page.getByRole('row').filter({ hasText: archivedName });
    await expect(archivedRow).toContainText(/1\s?500/);

    // Edit: change the price through the row's name button.
    await page.getByRole('button', { name: archivedName, exact: true }).click();
    const editDrawer = page.getByRole('dialog');
    await expect(editDrawer.getByLabel('Name', { exact: true })).toHaveValue(archivedName);
    await editDrawer.getByLabel('Price', { exact: true }).fill('1800');
    await editDrawer.getByRole('button', { name: 'Save package' }).click();
    await expect(editDrawer).toBeHidden();
    await expect(archivedRow).toContainText(/1\s?800/);

    // Archive.
    await page.getByRole('button', { name: `Actions for ${archivedName}` }).click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
    await expect(archivedRow).toContainText('Archived');

    // A second package the discount can be limited to.
    await page.getByRole('button', { name: 'New package' }).click();
    const secondDrawer = page.getByRole('dialog');
    await secondDrawer.getByLabel('Name', { exact: true }).fill(keptName);
    await secondDrawer.getByLabel('Price', { exact: true }).fill('2500');
    await secondDrawer.getByRole('button', { name: 'Save package' }).click();
    await expect(secondDrawer).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: keptName })).toBeVisible();

    // Discount limited to the kept package.
    await page.getByRole('tab', { name: 'Discounts' }).click();
    await page.getByRole('button', { name: 'New discount' }).click();
    const discountDrawer = page.getByRole('dialog');
    await discountDrawer.getByLabel('Name', { exact: true }).fill(discountName);
    await discountDrawer.getByLabel('Value', { exact: true }).fill('10');
    await discountDrawer.getByRole('button', { name: 'Selected packages' }).click();
    await expect(discountDrawer.getByRole('checkbox', { name: archivedName })).toHaveCount(0);
    await discountDrawer.getByRole('checkbox', { name: keptName }).click();
    await discountDrawer.getByRole('button', { name: 'Save discount' }).click();
    await expect(discountDrawer).toBeHidden();
    const discountRow = page.getByRole('row').filter({ hasText: discountName });
    await expect(discountRow).toContainText(keptName);
    await expect(discountRow).toContainText('10 %');
  });
});
