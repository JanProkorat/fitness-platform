/**
 * Plan template editor views (epic #1237, task #1241): the Day view, the meal-detail popover, the
 * add-meal drawer, the read-only Nutrition view and "copy the meals from another template".
 * Runs against the real harness, no mocked APIs; the shell and week grid are covered by
 * plan-template-editor.spec.ts.
 */
import { request as apiRequest, type Locator, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';
const DAILY_KCAL = 2000;
const BREAKFAST_AND_LUNCH = ['Breakfast', 'Lunch'];

interface LoginResponseBody {
  accessToken: string;
}

interface CreatedBody {
  templateId?: string;
  recipeId?: string;
}

interface FoodsSearchBody {
  foods?: { foodId?: string }[];
}

type WeeksBody = {
  weekNumber: number;
  days: { dayOfWeek: number; meals: { kind: string; order: number; foods: unknown[]; recipes: unknown[] }[] }[];
}[];

async function withApi<T>(baseURL: string, run: (api: Awaited<ReturnType<typeof apiRequest.newContext>>, auth: Record<string, string>) => Promise<T>): Promise<T> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[plan-template-editor-views] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const login = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!login.ok()) {
      throw new Error(`[plan-template-editor-views] login as qa.nutri returned ${login.status()}.`);
    }
    const { accessToken } = (await login.json()) as LoginResponseBody;
    return await run(api, { Authorization: `Bearer ${accessToken}` });
  } finally {
    await api.dispose();
  }
}

/** Seven days per week; each day holds one empty meal per kind. */
function buildWeeks(weekCount: number, kinds: string[]): WeeksBody {
  return Array.from({ length: weekCount }, (_, weekIndex) => ({
    weekNumber: weekIndex + 1,
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      dayOfWeek: dayIndex + 1,
      meals: kinds.map((kind, mealIndex) => ({ kind, order: mealIndex + 1, foods: [], recipes: [] })),
    })),
  }));
}

async function createTemplate(baseURL: string, name: string, weeks: WeeksBody): Promise<string> {
  return withApi(baseURL, async (api, headers) => {
    const response = await api.post('/nutrition/plan-templates', {
      headers,
      data: { name, goal: 'Maintain', globalSettings: { dailyKcal: DAILY_KCAL }, weeks },
    });
    if (!response.ok()) {
      throw new Error(`[plan-template-editor-views] POST /nutrition/plan-templates returned ${response.status()}.`);
    }
    const templateId = ((await response.json()) as CreatedBody).templateId;
    if (!templateId) {
      throw new Error('[plan-template-editor-views] create response carried no templateId.');
    }
    return templateId;
  });
}

async function deleteTemplate(baseURL: string, templateId: string): Promise<void> {
  await withApi(baseURL, (api, headers) => api.delete(`/nutrition/plan-templates/${templateId}`, { headers }));
}

async function createRecipe(baseURL: string, name: string): Promise<string> {
  return withApi(baseURL, async (api, headers) => {
    const search = await api.get('/foods/search?q=Apple', { headers });
    const foodId = ((await search.json()) as FoodsSearchBody).foods?.find((food) => food.foodId)?.foodId;
    if (!foodId) {
      throw new Error('[plan-template-editor-views] GET /foods/search?q=Apple returned no food.');
    }
    const response = await api.post('/recipes', {
      headers,
      data: {
        name,
        servings: 2,
        mealTypes: ['Lunch'],
        dietaryPreferences: [],
        foods: [{ foodExternalId: foodId, amountGrams: 200 }],
        steps: ['Mix.'],
      },
    });
    if (!response.ok()) {
      throw new Error(`[plan-template-editor-views] POST /recipes returned ${response.status()}.`);
    }
    const recipeId = ((await response.json()) as CreatedBody).recipeId;
    if (!recipeId) {
      throw new Error('[plan-template-editor-views] POST /recipes returned no recipeId.');
    }
    return recipeId;
  });
}

async function deleteRecipe(baseURL: string, recipeId: string): Promise<void> {
  await withApi(baseURL, (api, headers) => api.delete(`/recipes/${recipeId}`, { headers }));
}

function cell(page: Page, dayOfWeek: number, rowIndex: number): Locator {
  return page.locator(`[data-testid="meal-cell"][data-day="${dayOfWeek}"][data-row="${rowIndex}"]`);
}

/** Selects Monday's breakfast and adds the recipe to it with the library's + button. */
async function addRecipeToMondayBreakfast(page: Page, recipeName: string): Promise<void> {
  await cell(page, 1, 0).click();
  await page.getByLabel('Search recipes…').fill(recipeName);
  await page.getByRole('button', { name: new RegExp(`^Add ${recipeName} to the selected meal$`) }).click();
  await expect(cell(page, 1, 0)).toContainText(recipeName);
}

async function waitForSave(page: Page): Promise<void> {
  const put = page.waitForResponse(
    (response) => response.url().includes('/nutrition/plan-templates/') && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save' }).click();
  expect((await put).ok()).toBe(true);
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
}

test.describe('plan template editor views', () => {
  test('Day view: edit an amount, add and remove a meal, Save and reload', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const stamp = Date.now();
    const recipeName = `QA Views Recipe ${stamp}`;
    const recipeId = await createRecipe(origin, recipeName);
    const templateId = await createTemplate(origin, `QA Views Day ${stamp}`, buildWeeks(1, BREAKFAST_AND_LUNCH));
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await addRecipeToMondayBreakfast(page, recipeName);

      await page.getByRole('button', { name: 'Day', exact: true }).click();
      await expect(page.getByTestId('day-view')).toBeVisible();
      await expect(page.getByRole('tab', { name: /^Mon/ })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('meal-block')).toHaveCount(2);
      await expect(page.getByTestId('meal-share').first()).toBeVisible();

      // An invalid amount is flagged and never committed; a valid one is.
      const amount = page.getByLabel(`Amount of ${recipeName}`);
      await amount.fill('0');
      await expect(amount).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');
      await amount.fill('2');
      await expect(amount).not.toHaveAttribute('aria-invalid', 'true');

      // Add a Dinner after Breakfast through the drawer, then remove it again.
      await page.getByRole('button', { name: 'Add a meal after Breakfast' }).click();
      const drawer = page.getByRole('dialog');
      await drawer.getByRole('radio', { name: 'Dinner' }).click();
      await drawer.getByLabel('Note for the client').fill('Eat early.');
      await drawer.getByRole('button', { name: 'Add meal' }).click();
      await expect(page.getByTestId('meal-block')).toHaveCount(3);
      await expect(page.getByTestId('meal-block').nth(1).getByRole('heading', { name: 'Dinner' })).toBeVisible();
      await page.getByRole('button', { name: 'Remove Dinner' }).click();
      await expect(page.getByTestId('meal-block')).toHaveCount(2);

      await waitForSave(page);
      await page.reload();
      await page.getByRole('button', { name: 'Day', exact: true }).click();
      await expect(page.getByLabel(`Amount of ${recipeName}`)).toHaveValue('2');
    } finally {
      await deleteTemplate(origin, templateId);
      await deleteRecipe(origin, recipeId);
    }
  });

  test('Day view: reordering meals by dragging the card is one Undo step', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Views Reorder ${Date.now()}`, buildWeeks(1, ['Breakfast', 'Lunch', 'Dinner']));
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await page.getByRole('button', { name: 'Day', exact: true }).click();
      const titles = () => page.locator('[data-testid="meal-block"] h3').allInnerTexts();
      expect(await titles()).toEqual(['Breakfast', 'Lunch', 'Dinner']);

      const from = await page.locator('[data-testid="meal-block"]').first().locator('h3').boundingBox();
      const to = await page.locator('[data-testid="meal-block"]').nth(2).locator('h3').boundingBox();
      if (!from || !to) {
        throw new Error('[plan-template-editor-views] meal cards are not visible.');
      }
      await page.mouse.move(from.x + 10, from.y + 5);
      await page.mouse.down();
      await page.mouse.move(from.x + 14, from.y + 20, { steps: 4 });
      await page.mouse.move(to.x + 10, to.y + to.height + 20, { steps: 15 });
      await page.mouse.up();
      await expect.poll(titles).not.toEqual(['Breakfast', 'Lunch', 'Dinner']);
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');

      await page.getByRole('button', { name: 'Undo' }).click();
      await expect.poll(titles).toEqual(['Breakfast', 'Lunch', 'Dinner']);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('meal detail popover: edit servings, copy to another weekday, close with Escape', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const stamp = Date.now();
    const recipeName = `QA Views Popover ${stamp}`;
    const recipeId = await createRecipe(origin, recipeName);
    const templateId = await createTemplate(origin, `QA Views Popover ${stamp}`, buildWeeks(1, BREAKFAST_AND_LUNCH));
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await addRecipeToMondayBreakfast(page, recipeName);

      await cell(page, 1, 0).click();
      const detail = page.getByTestId('meal-detail');
      await expect(detail).toBeVisible();

      // The library stays usable while the popover is open.
      await expect(detail.getByRole('heading')).toContainText('Breakfast');
      await detail.getByLabel(`Amount of ${recipeName}`).fill('3');

      await detail.getByRole('button', { name: 'Tue', exact: true }).click();
      await detail.getByRole('button', { name: 'Copy', exact: true }).click();
      await expect(cell(page, 2, 0)).toContainText(recipeName);

      await page.keyboard.press('Escape');
      await expect(detail).toHaveCount(0);
    } finally {
      await deleteTemplate(origin, templateId);
      await deleteRecipe(origin, recipeId);
    }
  });

  test('Nutrition view is read-only and colours meals against their share of the day', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const stamp = Date.now();
    const recipeName = `QA Views Nutrition ${stamp}`;
    const recipeId = await createRecipe(origin, recipeName);
    const templateId = await createTemplate(origin, `QA Views Nutrition ${stamp}`, buildWeeks(1, BREAKFAST_AND_LUNCH));
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await addRecipeToMondayBreakfast(page, recipeName);

      await page.getByRole('button', { name: 'Nutrition', exact: true }).click();
      await expect(page.getByTestId('nutrition-cell')).toHaveCount(14);
      await expect(page.getByTestId('meal-cell')).toHaveCount(0);
      await expect(page.getByTestId('nutrition-cell').first()).not.toHaveAttribute('data-status', 'empty');
      await expect(page.getByTestId('nutrition-cell').nth(1)).toHaveAttribute('data-status', 'empty');
      await expect(page.getByText(/Meal shares: breakfast 25 %/)).toBeVisible();

      await page.getByRole('button', { name: 'Meals', exact: true }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(14);
    } finally {
      await deleteTemplate(origin, templateId);
      await deleteRecipe(origin, recipeId);
    }
  });

  test('an empty week can copy the meals from another template', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const stamp = Date.now();
    const sourceName = `QA Views Source ${stamp}`;
    const sourceId = await createTemplate(origin, sourceName, buildWeeks(1, ['Breakfast', 'Lunch', 'Dinner']));
    const targetId = await createTemplate(origin, `QA Views Target ${stamp}`, buildWeeks(2, []));
    try {
      await page.goto(`/plan-templates/${targetId}`);
      await expect(page.getByTestId('meal-cell')).toHaveCount(0);

      await page.getByRole('button', { name: 'copy the meals from another template' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Search templates…').fill(sourceName);
      await dialog.getByRole('button', { name: new RegExp(sourceName) }).click();

      await expect(page.getByTestId('meal-cell')).toHaveCount(21);
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');

      // The second, still-empty week gets the same rows.
      await page.getByRole('tab', { name: 'Week 2' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);

      await waitForSave(page);
    } finally {
      await deleteTemplate(origin, targetId);
      await deleteTemplate(origin, sourceId);
    }
  });
});
