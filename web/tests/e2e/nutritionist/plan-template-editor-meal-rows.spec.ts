/**
 * Plan template editor meal rows (epic #1237, task #1273; epic #1424, task #1432): the staged meal
 * picker on an empty week, removing a meal row from the current week, and adding a meal to the whole
 * week or to one day from the insert line. Runs against the real harness, no mocked APIs; the shell,
 * grid and preset are covered by plan-template-editor.spec.ts.
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

/** The add-meal drawer opened from an insert line or the "Add meal" button. */
function drawer(page: Page): Locator {
  return page.getByRole('dialog');
}

/** Hovers the insert line above the nth row boundary of the scope and presses its + button. */
async function pressInsertLine(scope: Locator, boundary: number): Promise<void> {
  const line = scope.getByTestId('meal-insert-line').nth(boundary);
  await line.hover();
  const button = line.getByTestId('meal-insert-button');
  await expect(button).toHaveCSS('opacity', '1');
  await button.click();
}

async function confirmDrawer(page: Page): Promise<void> {
  await drawer(page).getByRole('button', { name: 'Add meal', exact: true }).click();
  await expect(drawer(page)).toHaveCount(0);
}

/** Selects the meal block and adds the first Apple ingredient with the library's + button (Day view). */
async function addAppleToBlock(page: Page, block: Locator): Promise<void> {
  await block.click({ position: { x: 8, y: 8 } });
  await page.getByRole('tab', { name: 'Ingredients' }).click();
  await page.getByLabel('Search ingredients…').fill('Apple');
  const addButton = page
    .getByTestId('library-card')
    .first()
    .getByRole('button', { name: /^Add .* to the selected meal$/ });
  await expect(addButton).toBeEnabled();
  await addButton.click();
}

function mealBlock(page: Page, label: string): Locator {
  return page.locator(`[data-testid="meal-block"][aria-label="${label}"]`);
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

  test('the insert line adds the fitting kind to the whole week in one edit, and one Undo takes it back', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows Week Add ${Date.now()}`, ['Breakfast', 'Lunch', 'Dinner']);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);
      // No line above the first row or below the last: three rows have two lines.
      await expect(page.getByTestId('meal-insert-line')).toHaveCount(2);

      await pressInsertLine(page.getByRole('group', { name: 'Week meals' }), 0);
      await expect(drawer(page)).toContainText('Week 1');
      await expect(drawer(page).getByRole('radio', { name: 'Snack', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(drawer(page).getByTestId('add-meal-week-summary')).toHaveText('Will be added to 7 days');
      await expect(drawer(page).getByLabel(/Note for the client/)).toHaveCount(0);
      await confirmDrawer(page);

      await expect(page.getByTestId('meal-cell')).toHaveCount(28);
      await expect(page.getByRole('button', { name: 'Remove Snack from week 1' })).toHaveCount(1);
      await page.getByRole('tab', { name: 'Week 2' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);
      await page.getByRole('tab', { name: 'Week 1' }).click();

      await page.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);
      await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a gap with no free kind preselects nothing; the always-visible Add meal button opens the week drawer empty', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows No Fit ${Date.now()}`, ['Breakfast', 'Lunch', 'Dinner']);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      const addMeal = page.getByTestId('add-meal-week');
      await expect(addMeal).toBeVisible();
      await expect(addMeal).toHaveCSS('opacity', '1');
      const cellHeight = (await cell(page, 1, 0).boundingBox())?.height;
      await addMeal.click();
      await expect(drawer(page).getByRole('radio', { checked: true })).toHaveCount(0);
      await expect(drawer(page).getByRole('button', { name: 'Add meal', exact: true })).toBeDisabled();
      await drawer(page).getByRole('button', { name: 'Cancel' }).click();
      // The button sits inside the last label cell: it adds no grid row and the tiles keep their height.
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);
      expect((await cell(page, 1, 0).boundingBox())?.height).toBe(cellHeight);

      // Fill every gap: Snack between Breakfast and Lunch, Snack 2 between Lunch and Dinner.
      await pressInsertLine(page.getByRole('group', { name: 'Week meals' }), 0);
      await confirmDrawer(page);
      await pressInsertLine(page.getByRole('group', { name: 'Week meals' }), 2);
      await expect(drawer(page).getByRole('radio', { name: 'Snack 2', exact: true })).toHaveAttribute('aria-checked', 'true');
      await confirmDrawer(page);
      await expect(page.getByTestId('meal-cell')).toHaveCount(35);

      // No kind fits between Breakfast and the new Snack, so that line preselects nothing.
      await pressInsertLine(page.getByRole('group', { name: 'Week meals' }), 0);
      await expect(drawer(page).getByRole('radio', { checked: true })).toHaveCount(0);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a kind only some days have shows who has it; a kind every day has is disabled', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows Partial ${Date.now()}`, ['Breakfast', 'Lunch']);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      // Add a Snack to Monday only, from the Day view's insert line.
      await page.getByRole('button', { name: 'Day', exact: true }).click();
      await pressInsertLine(page.getByTestId('day-view'), 0);
      await expect(drawer(page).getByRole('radio', { name: 'Snack', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(drawer(page).getByLabel(/Note for the client/)).toBeVisible();
      await confirmDrawer(page);
      await expect(page.getByTestId('meal-block')).toHaveCount(3);

      await page.getByRole('button', { name: 'Week', exact: true }).click();
      await page.getByTestId('add-meal-week').click();
      await drawer(page).getByRole('radio', { name: 'Snack', exact: true }).click();
      await expect(drawer(page).getByTestId('add-meal-week-summary')).toHaveText('Will be added to 6 days; Monday already has it');
      await expect(drawer(page).getByRole('radio', { name: /^Breakfast/ })).toBeDisabled();
      await expect(drawer(page).getByRole('radio', { name: /^Breakfast/ })).toContainText('Already in every day');
      await confirmDrawer(page);
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);

      // Every day has a Snack now, so it is disabled the next time.
      await page.getByTestId('add-meal-week').click();
      await expect(drawer(page).getByRole('radio', { name: /^Snack(?! 2)/ })).toBeDisabled();
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a Day view insert keeps the other days\' meals in their rows, and a library add lands in the new meal', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows Day Insert ${Date.now()}`, ['Breakfast', 'Lunch']);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      // Tuesday's Lunch holds food; Lunch is row 1 until a Snack appears on any day.
      await addAppleTo(page, 2, 1);

      await page.getByRole('button', { name: 'Day', exact: true }).click();
      // The Day view opens on the day of the selected cell (Tuesday); go to Monday explicitly.
      await page.getByRole('tab', { name: /^Mon/ }).click();
      await expect(page.getByRole('tab', { name: /^Mon/ })).toHaveAttribute('aria-selected', 'true');
      await pressInsertLine(page.getByTestId('day-view'), 0);
      await confirmDrawer(page);
      await expect(page.getByTestId('meal-block')).toHaveCount(3);

      // The new Snack belongs to Monday only; every other day keeps its Lunch in the Lunch row.
      await page.getByRole('button', { name: 'Week', exact: true }).click();
      await expect(page.getByTestId('meal-cell')).toHaveCount(21);
      await expect(cell(page, 1, 1)).toContainText('Empty');
      await expect(cell(page, 2, 1)).toContainText('Empty');
      await expect(cell(page, 2, 2)).not.toContainText('Empty');
      await expect(cell(page, 3, 2)).toContainText('Empty');

      // In the Day view the library add goes to the meal the user selected, not to the one at its stored position.
      await page.getByRole('button', { name: 'Day', exact: true }).click();
      await expect(page.getByRole('tab', { name: /^Mon/ })).toHaveAttribute('aria-selected', 'true');
      await addAppleToBlock(page, mealBlock(page, 'Snack'));
      await expect(mealBlock(page, 'Snack').getByTestId('meal-item')).toHaveCount(1);
      await expect(mealBlock(page, 'Lunch').getByTestId('meal-item')).toHaveCount(0);
      await expect(mealBlock(page, 'Breakfast').getByTestId('meal-item')).toHaveCount(0);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('the Day view insert line adds a meal of the fitting kind between two meals of that day', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows Day Line ${Date.now()}`, ['Breakfast', 'Lunch']);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await page.getByRole('button', { name: 'Day', exact: true }).click();
      const dayView = page.getByTestId('day-view');
      await expect(dayView.getByTestId('meal-insert-line')).toHaveCount(1);

      await pressInsertLine(dayView, 0);
      await expect(drawer(page)).toContainText('Monday');
      await confirmDrawer(page);

      await expect(page.getByTestId('meal-block')).toHaveCount(3);
      await expect(page.getByTestId('meal-block').nth(1)).toHaveAttribute('aria-label', 'Snack');
      await expect(dayView.getByTestId('meal-insert-line')).toHaveCount(2);

      await page.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByTestId('meal-block')).toHaveCount(2);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('removing a row removes that kind from every day and keeps the others in place', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Rows Remove Kind ${Date.now()}`, ['Breakfast', 'Lunch', 'Dinner']);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await addAppleTo(page, 1, 2);

      await page.getByRole('button', { name: 'Remove Lunch from week 1' }).click();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(page.getByTestId('meal-cell')).toHaveCount(14);
      await expect(page.getByRole('button', { name: 'Remove Lunch from week 1' })).toHaveCount(0);
      // Dinner moved up to row 1 with its food.
      await expect(cell(page, 1, 1)).not.toContainText('Empty');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test.describe('on a touch device', () => {
    test.use({ hasTouch: true });

    test('the remove-row button is visible without hover and has a larger tap target', async ({ page, baseURL }) => {
      const origin = baseURL ?? 'http://localhost:5173';
      const templateId = await createTemplate(origin, `QA Rows Touch ${Date.now()}`, ['Breakfast', 'Lunch']);
      try {
        await page.goto(`/plan-templates/${templateId}`);
        const remove = page.getByRole('button', { name: 'Remove Lunch from week 1' });
        await expect(remove).toHaveCSS('opacity', '1');
        const box = await remove.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(36);
        expect(box?.height).toBeGreaterThanOrEqual(36);
        await remove.tap();
        await expect(page.getByTestId('meal-cell')).toHaveCount(7);
      } finally {
        await deleteTemplate(origin, templateId);
      }
    });
  });
});
