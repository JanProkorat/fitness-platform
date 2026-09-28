/**
 * #1115 — Ingredients page: list load, search, tag filter, create/edit/
 * delete a private ingredient, and a read-only system row.
 *
 * Path is deliberately under nutritionist/ — every project in
 * playwright.config.ts matches a role subfolder via testMatch, and
 * create/edit/delete on `/foods` are Nutritionist-only
 * (`CreateFoodEndpoint`/`UpdateFoodEndpoint`/`DeleteFoodEndpoint` all gate on
 * `Roles(AppRoles.Nutritionist)`) — the trainer fixture can read the list but
 * cannot exercise the drawer's write paths.
 */
import { nutritionistTest as test, expect } from '../fixtures/auth';

test.describe('ingredients page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
  });

  test('list loads with a table and a pagination footer', async ({ page }) => {
    await expect(page.getByText(/Viewing \d+ of \d+/)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Library' })).toBeVisible();
  });

  test('searching filters the list by name and updates the URL', async ({ page }) => {
    // Wait for the actual filtered search response (not just the URL/debounce
    // settling) before reading rows — otherwise rows.count() can be read
    // mid-shrink, while the list still holds unfiltered rows that vanish a
    // moment later as the filtered response renders, and a fixed nth(i) index
    // starts pointing at a row that no longer exists.
    const searchResponse = page.waitForResponse(
      (response) => response.url().includes('/foods/search') && response.url().includes('q=Apple'),
    );
    await page.getByPlaceholder('Search ingredients…').fill('Apple');
    await searchResponse;
    await page.waitForURL(/q=Apple/);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect
      .poll(async () => (await rows.allTextContents()).every((text) => /Apple/i.test(text)))
      .toBe(true);
  });

  test('a system row opens the drawer read-only', async ({ page }) => {
    await page.getByPlaceholder('Search ingredients…').fill('Apple');
    await page.waitForURL(/q=Apple/);
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow.getByText('System', { exact: true })).toBeVisible();

    await firstRow.click();
    await expect(page.getByRole('heading', { name: 'Ingredient' })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save Ingredient' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    // Scoped to the sheet footer: the corner "x" close button also has the
    // accessible name "Close" (its sr-only label reuses common.close), so an
    // unscoped getByRole('button', { name: 'Close' }) matches both.
    await page.locator('[data-slot="sheet-footer"]').getByRole('button', { name: 'Close' }).click();
  });

  test('creating, editing, filtering by tag, and deleting a private ingredient', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const name = `QA E2E Ingredient ${uniqueSuffix}`;
    const tag = `qa-e2e-${uniqueSuffix}`;

    await page.getByRole('button', { name: '+ New Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Category').selectOption('Fruit');
    await page.getByLabel('Calories / 100g').fill('50');
    await page.getByLabel('Protein / 100g').fill('1');
    await page.getByLabel('Carbs / 100g').fill('12');
    await page.getByLabel('Fat / 100g').fill('0');
    await page.getByLabel('Unit').selectOption('piece');
    await page.getByLabel('Serving Size').fill('120');

    await page.getByLabel('Tags').fill(tag);
    await page.getByLabel('Tags').press('Enter');
    await expect(page.getByText(tag, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Save Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toHaveCount(0);

    // Filter down to the freshly-created row via the Tags pill.
    await page.getByRole('button', { name: 'Tags' }).click();
    await page.getByText(tag, { exact: true }).click();
    await page.waitForURL(/tags=/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('cell', { name })).toBeVisible();
    await expect(page.getByText('Mine', { exact: true })).toBeVisible();

    // Edit it.
    await page.getByRole('cell', { name }).click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toBeVisible();
    await page.getByLabel('Calories / 100g').fill('55');
    await page.getByRole('button', { name: 'Save Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toHaveCount(0);
    await expect(page.getByText('55 kcal / 100g')).toBeVisible();

    // Delete it, with confirmation.
    await page.getByRole('cell', { name }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Delete ingredient' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('cell', { name })).toHaveCount(0);
  });

  test('empty submit shows translated required errors, never the raw zod message', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    // Unit is deliberately not asserted here — it defaults to "Portion" on
    // create, so it's never blank on this path.
    await page.getByRole('button', { name: 'Save Ingredient' }).click();

    await expect(page.getByText('Name is required.')).toBeVisible();
    await expect(page.getByText('Category is required.')).toBeVisible();
    await expect(page.getByText('Calories is required.')).toBeVisible();
    await expect(page.getByText('Protein is required.')).toBeVisible();
    await expect(page.getByText('Carbs is required.')).toBeVisible();
    await expect(page.getByText('Fat is required.')).toBeVisible();
    await expect(page.getByText('Serving size is required.')).toBeVisible();

    // The zod schema's internal placeholder message is the bare string
    // "required" — before this fix it rendered verbatim for Calories, and
    // Protein/Carbs/Fat rendered no message at all. Assert it never
    // surfaces standalone (a translated sentence like "Calories is
    // required." legitimately contains the word, but never as the whole
    // text of an element).
    await expect(page.getByText('required', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('an inconsistent kcal value shows the KCAL_INCONSISTENT inline error on Calories', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    await page.getByLabel('Name').fill(`QA Kcal Check ${Date.now()}`);
    await page.getByLabel('Category').selectOption('Fruit');
    // 1g protein + 12g carbs + 0g fat = 52 kcal by the ±10% rule; 500 is far
    // outside that range, so CreateFoodEndpoint's KCAL_INCONSISTENT check
    // rejects it with a 400 — the drawer must surface that inline on the
    // Calories field rather than showing nothing (root cause: the NSwag
    // client throws the parsed body directly on 400, not an AxiosError, and
    // getErrorCode only read the AxiosError shape).
    await page.getByLabel('Calories / 100g').fill('500');
    await page.getByLabel('Protein / 100g').fill('1');
    await page.getByLabel('Carbs / 100g').fill('12');
    await page.getByLabel('Fat / 100g').fill('0');
    await page.getByLabel('Unit').selectOption('piece');
    await page.getByLabel('Serving Size').fill('120');

    await page.getByRole('button', { name: 'Save Ingredient' }).click();

    await expect(page.getByText(/doesn.t match macronutrients/i)).toBeVisible();
    // The drawer stays open — the create request was rejected, not fulfilled.
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
