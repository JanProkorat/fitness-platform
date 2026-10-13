/**
 * Client detail overview for a nutritionist-only link (the QA nutritionist):
 * no Workouts tab, a Meal compliance / Weight change / Client since stat row,
 * only the meal plan card, and a profile with allergies and diet rows but no
 * injuries or training rows.
 *
 * Weight change spans the seeded eight weekly measurements (84.0 kg down to
 * 80.5 kg), so it reads -3.5 kg; the caption carries the 76 kg onboarding goal.
 * Run against a freshly reset harness.
 */
import { nutritionistTest as test, expect } from '../fixtures/auth';

test.describe('client detail — nutritionist-only overview', () => {
  test('renders the nutritionist layout', async ({ page }) => {
    const verdictRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/verdict')) {
        verdictRequests.push(request.url());
      }
    });

    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const row = page.getByRole('row', { name: /QA Client/ });
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: /QA Client/ }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /QA Client/ })).toBeVisible();

    // Tabs: Nutrition is live, Workouts is not rendered.
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeEnabled();
    await expect(page.getByRole('tab', { name: 'Nutrition' })).toBeEnabled();
    await expect(page.getByRole('tab', { name: 'Workouts' })).toHaveCount(0);

    // Header facts: the nutritionist link shows the meal plan fact and no training plan fact;
    // the weight change since the first weigh-in matches the seeded 84.0 -> 80.5 kg.
    const facts = page.getByTestId('client-header-facts');
    await expect(facts.getByText('Meal plan', { exact: true })).toBeVisible();
    await expect(facts.getByText('Training plan', { exact: true })).toHaveCount(0);
    await expect(facts).toContainText('80.5 kg');
    await expect(page.getByTestId('client-weight-change')).toHaveText('3.5 kg');

    // Stat row.
    for (const label of ['Meal compliance', 'Weight change', 'Client since']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    for (const label of ['Training compliance', 'PRs this month']) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }

    const weightTile = page.getByText('Weight change', { exact: true }).locator('xpath=..');
    await expect(weightTile).toContainText(/[-−]3\.5 kg/);
    await expect(weightTile).toContainText('76 kg goal');

    // Only the meal plan card; no workout card or no-access placeholder.
    await expect(page.getByRole('region', { name: 'Current meal plan' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Latest workout' })).toHaveCount(0);
    await expect(page.getByText('No training access')).toHaveCount(0);

    // Client profile: allergies highlight plus diet and daily target rows.
    await expect(page.getByText('Allergies', { exact: true })).toBeVisible();
    await expect(page.getByText('Diet style', { exact: true })).toBeVisible();
    await expect(page.getByText('Daily target', { exact: true })).toBeVisible();
    await expect(page.getByText('Injuries', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Training days', { exact: true })).toHaveCount(0);

    // Check-in trend and weight stay for every role.
    for (const name of ['Check-in trend', 'Weight', 'Recent activity', 'Client profile']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }

    // The PR verdict is training-only and is never requested.
    expect(verdictRequests).toEqual([]);
  });
});
