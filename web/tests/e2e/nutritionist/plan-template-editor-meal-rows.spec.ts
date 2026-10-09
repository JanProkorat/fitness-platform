/**
 * Plan template editor meal rows (epic #1237, task #1273): the staged meal picker on an empty week
 * and removing a meal row from the current week. Runs against the real harness, no mocked APIs; the
 * shell, grid and preset are covered by plan-template-editor.spec.ts.
 */
import { request as apiRequest, type Locator, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';
const DAILY_KCAL = 2000;

interface LoginResponseBody {
  accessToken: string;
}

interface CreatedBody {
  templateId?: string;
}

type WeeksBody = {
  weekNumber: number;
  days: { dayOfWeek: number; meals: { kind: string; order: number; foods: unknown[]; recipes: unknown[] }[] }[];
}[];

async function withApi<T>(
  baseURL: string,
  run: (api: Awaited<ReturnType<typeof apiRequest.newContext>>, auth: Record<string, string>) => Promise<T>,
): Promise<T> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[plan-template-editor-meal-rows] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const login = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!login.ok()) {
      throw new Error(`[plan-template-editor-meal-rows] login as qa.nutri returned ${login.status()}.`);
    }
    const { accessToken } = (await login.json()) as LoginResponseBody;
    return await run(api, { Authorization: `Bearer ${accessToken}` });
  } finally {
    await api.dispose();
  }
}

/** Seven days per week; each day holds one empty meal per kind (none for an empty-state week). */
function buildWeeks(weekCount: number, kinds: string[]): WeeksBody {
  return Array.from({ length: weekCount }, (_, weekIndex) => ({
    weekNumber: weekIndex + 1,
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      dayOfWeek: dayIndex + 1,
      meals: kinds.map((kind, mealIndex) => ({ kind, order: mealIndex + 1, foods: [], recipes: [] })),
    })),
  }));
}

async function createTemplate(baseURL: string, name: string, kinds: string[]): Promise<string> {
  return withApi(baseURL, async (api, headers) => {
    const response = await api.post('/nutrition/plan-templates', {
      headers,
      data: { name, goal: 'Maintain', globalSettings: { dailyKcal: DAILY_KCAL }, weeks: buildWeeks(2, kinds) },
    });
    if (!response.ok()) {
      throw new Error(`[plan-template-editor-meal-rows] POST /nutrition/plan-templates returned ${response.status()}.`);
    }
    const templateId = ((await response.json()) as CreatedBody).templateId;
    if (!templateId) {
      throw new Error('[plan-template-editor-meal-rows] create response carried no templateId.');
    }
    return templateId;
  });
}

async function deleteTemplate(baseURL: string, templateId: string): Promise<void> {
  await withApi(baseURL, async (api, headers) => {
    await api.delete(`/nutrition/plan-templates/${templateId}`, { headers });
  });
}

function cell(page: Page, dayOfWeek: number, rowIndex: number): Locator {
  return page.locator(`[data-testid="meal-cell"][data-day="${dayOfWeek}"][data-row="${rowIndex}"]`);
}

/** Selects the cell and adds the first Apple ingredient to it with the library's + button. */
async function addAppleTo(page: Page, dayOfWeek: number, rowIndex: number): Promise<void> {
  await cell(page, dayOfWeek, rowIndex).click();
  await page.getByRole('tab', { name: 'Ingredients' }).click();
  await page.getByLabel('Search ingredients…').fill('Apple');
  const addButton = page
    .getByTestId('library-card')
    .first()
    .getByRole('button', { name: /^Add .* to the selected meal$/ });
  await expect(addButton).toBeEnabled();
  await addButton.click();
  await expect(cell(page, dayOfWeek, rowIndex)).not.toContainText('Empty');
}

/** A picker chip; the "most common" preset button also starts with Breakfast, so match on aria-pressed. */
function chip(page: Page, name: string): Locator {
  return page.locator('button[aria-pressed]', { hasText: name });
}

test.describe('plan template editor meal rows', () => {
  test('picker chips only stage: select, x2, clear; Done adds every row at once and one Undo takes them back', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows Picker ${Date.now()}`, []);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expect(page.getByText('Which meals does a day have?')).toBeVisible();
      const done = page.getByRole('button', { name: /^Done \(/ });
      await expect(done).toHaveText('Done (0)');
      await expect(done).toBeDisabled();

      const snack = chip(page, 'Snack');
      await snack.click();
      await expect(snack).toHaveAttribute('aria-pressed', 'true');
      await expect(done).toHaveText('Done (1)');
      await snack.click();
      await expect(snack).toHaveText(/Snack\s*×2/);
      await expect(done).toHaveText('Done (2)');
      await snack.click();
      await expect(snack).toHaveAttribute('aria-pressed', 'false');
      await expect(done).toHaveText('Done (0)');
      await expect(done).toBeDisabled();

      await chip(page, 'Breakfast').click();
      await snack.click();
      await snack.click();
      await expect(done).toHaveText('Done (3)');
      // Nothing is added until Done.
      await expect(page.getByTestId('meal-cell')).toHaveCount(0);
      await expect(page.getByText('Which meals does a day have?')).toBeVisible();

      await done.click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);
      await expect(page.getByText('Which meals does a day have?')).toHaveCount(0);
      await page.getByRole('tab', { name: 'Week 2' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);
      await page.getByRole('tab', { name: 'Week 1' }).click();

      await page.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(0);
      await expect(page.getByText('Which meals does a day have?')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('an empty row is removed at once with no dialog, in this week only, and one Undo restores it', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows Empty ${Date.now()}`, ['Breakfast', 'Lunch']);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expect(page.getByTestId('meal-cell')).toHaveCount(14);

      const remove = page.getByRole('button', { name: 'Remove Lunch from week 1' });
      await expect(remove).toHaveCSS('opacity', '0');
      await remove.hover();
      await expect(remove).toHaveCSS('opacity', '1');
      await remove.click();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(page.getByTestId('meal-cell')).toHaveCount(7);

      await page.getByRole('tab', { name: 'Week 2' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(14);
      await page.getByRole('tab', { name: 'Week 1' }).click();

      await page.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(14);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a row with food asks first: Cancel keeps it, Remove drops it from this week only, one Undo restores it', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows Food ${Date.now()}`, ['Breakfast', 'Lunch']);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await addAppleTo(page, 1, 0);
      await addAppleTo(page, 2, 0);

      const remove = page.getByRole('button', { name: 'Remove Breakfast from week 1' });
      await remove.click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toContainText('Remove Breakfast from week 1?');
      await expect(dialog).toContainText('2 days have food in it (Monday, Tuesday)');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTestId('meal-cell')).toHaveCount(14);
      await expect(cell(page, 1, 0)).not.toContainText('Empty');

      await remove.click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Remove Breakfast' }).click();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(page.getByTestId('meal-cell')).toHaveCount(7);

      await page.getByRole('tab', { name: 'Week 2' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(14);
      await page.getByRole('tab', { name: 'Week 1' }).click();

      await page.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(14);
      await expect(cell(page, 1, 0)).not.toContainText('Empty');
      await expect(cell(page, 2, 0)).not.toContainText('Empty');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });
});
