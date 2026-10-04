/**
 * Client detail overview — the "Current meal plan" card derives its macro
 * split from the plan's grams (160 g protein / 240 g carbs / 100 g fat over
 * the seeded daily kcal target), so the shares must read 26 / 38 / 36 %.
 *
 * The seeded plan's window goes stale a week after a /test/reset; run this
 * against a freshly reset harness.
 */
import { nutritionistTest as test, expect } from '../fixtures/auth';

test.describe('client detail — meal plan card', () => {
  test('shows the macro shares derived from the seeded plan grams', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const row = page.getByRole('row', { name: /QA Client/ });
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: /QA Client/ }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /QA Client/ })).toBeVisible();

    const mealPlanCard = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Current meal plan' }) }).last();
    await expect(mealPlanCard).toContainText('38 % Carb');
    await expect(mealPlanCard).toContainText('26 % Protein');
    await expect(mealPlanCard).toContainText('36 % Fat');
  });
});
