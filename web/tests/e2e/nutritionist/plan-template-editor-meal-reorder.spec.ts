/**
 * Plan editor meal reorder (epic #1424, task #1436): dragging a meal card into the gap between two meals
 * of its day moves its contents there and shifts the rest; a card dropped on a filled tile of the same row
 * on another day swaps with it; Alt+ArrowUp / Alt+ArrowDown move a focused meal one slot. Each is one Undo
 * step. Runs against the real harness, no mocked APIs.
 *
 * A meal's contents are told apart by how many ingredients it holds (its cell shows "N items"), so the
 * Mon A/B/C/D example below is A = 2, B = 3, C = 4, D = 5 apples.
 */
import { request as apiRequest, type Locator, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';
const DAILY_KCAL = 2000;
const CLIENT_PROFILE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
/** Mon rows: Breakfast, Lunch, Snack 2, Dinner. */
const FOUR_KINDS = ['Breakfast', 'Lunch', 'AfternoonSnack', 'Dinner'];
const COUNTS = { a: 2, b: 3, c: 4, d: 5 };
/** Half the 12px gap between two meals. */
const HALF_GAP = 6;

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
    throw new Error('[plan-template-editor-meal-reorder] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const login = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!login.ok()) {
      throw new Error(`[plan-template-editor-meal-reorder] login as qa.nutri returned ${login.status()}.`);
    }
    const { accessToken } = (await login.json()) as LoginResponseBody;
    return await run(api, { Authorization: `Bearer ${accessToken}` });
  } finally {
    await api.dispose();
  }
}

interface Food {
  foodId: string;
  name: string;
  nutrientValue: Record<string, number | null>;
}

interface FoodsSearchBody {
  foods?: { foodId?: string; name?: string; nutrientValue?: Record<string, number | null> }[];
}

type Auth = Record<string, string>;
type Api = Awaited<ReturnType<typeof apiRequest.newContext>>;

/** The ingredient every seeded meal holds: found by its exact name, never by list position. */
async function findApple(api: Api, headers: Auth): Promise<Food> {
  const search = await api.get('/foods/search?q=Apple', { headers });
  const foods = ((await search.json()) as FoodsSearchBody).foods ?? [];
  const found = foods.find((food) => food.name?.toLowerCase() === 'apple' && food.foodId && food.nutrientValue);
  if (!found?.foodId || !found.name || !found.nutrientValue) {
    throw new Error('[plan-template-editor-meal-reorder] GET /foods/search?q=Apple returned no food named exactly "Apple".');
  }
  return { foodId: found.foodId, name: found.name, nutrientValue: found.nutrientValue };
}

function foodsOf(food: Food, count: number): unknown[] {
  return Array.from({ length: count }, () => ({
    foodExternalId: food.foodId,
    foodName: food.name,
    nutrientValuePer100Grams: food.nutrientValue,
    amountGrams: 100,
  }));
}

/** Monday's meals by kind: A, B, C, D. Every other day is empty. */
const MONDAY_COUNTS: Record<string, number> = {
  Breakfast: COUNTS.a,
  Lunch: COUNTS.b,
  AfternoonSnack: COUNTS.c,
  Dinner: COUNTS.d,
};

interface TemplateSeed {
  /** The kinds a day holds, in order. */
  kindsOf?: (dayIndex: number) => string[];
  /** How many ingredients the day's meal of the kind holds. */
  counts?: (dayIndex: number, kind: string) => number;
}

function mondayCounts(counts: Record<string, number>): (dayIndex: number, kind: string) => number {
  return (dayIndex, kind) => (dayIndex === 0 ? (counts[kind] ?? 0) : 0);
}

/** One week built from the seed; the meals come pre-filled so the editor opens ready, with nothing unsaved. */
function buildWeeks(food: Food, seed: TemplateSeed): WeeksBody {
  const kindsOf = seed.kindsOf ?? (() => FOUR_KINDS);
  const counts = seed.counts ?? mondayCounts(MONDAY_COUNTS);
  return [
    {
      weekNumber: 1,
      days: Array.from({ length: 7 }, (_, dayIndex) => ({
        dayOfWeek: dayIndex + 1,
        meals: kindsOf(dayIndex).map((kind, mealIndex) => ({
          kind,
          order: mealIndex + 1,
          foods: foodsOf(food, counts(dayIndex, kind)),
          recipes: [],
        })),
      })),
    },
  ];
}

async function createTemplate(baseURL: string, name: string, seed: TemplateSeed = {}): Promise<string> {
  return withApi(baseURL, async (api, headers) => {
    const food = await findApple(api, headers);
    const response = await api.post('/nutrition/plan-templates', {
      headers,
      data: { name, goal: 'Maintain', globalSettings: { dailyKcal: DAILY_KCAL }, weeks: buildWeeks(food, seed) },
    });
    if (!response.ok()) {
      throw new Error(`[plan-template-editor-meal-reorder] POST /nutrition/plan-templates returned ${response.status()}: ${await response.text()}`);
    }
    const templateId = ((await response.json()) as CreatedBody).templateId;
    if (!templateId) {
      throw new Error('[plan-template-editor-meal-reorder] create response carried no templateId.');
    }
    return templateId;
  });
}

async function deleteTemplate(baseURL: string, templateId: string): Promise<void> {
  await withApi(baseURL, (api, headers) => api.delete(`/nutrition/plan-templates/${templateId}`, { headers }));
}

function cell(page: Page, dayOfWeek: number, rowIndex: number): Locator {
  return page.locator(`[data-testid="meal-cell"][data-day="${dayOfWeek}"][data-row="${rowIndex}"]`);
}

/** Scrolls the element into view, then waits until two reads of its box match. */
async function settledBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  await locator.scrollIntoViewIfNeeded();
  let previous = '';
  let box = await locator.boundingBox();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = JSON.stringify(box);
    if (current === previous && box) {
      return box;
    }
    previous = current;
    await locator.page().waitForTimeout(50);
    box = await locator.boundingBox();
  }
  if (!box) {
    throw new Error('[plan-template-editor-meal-reorder] drag source or target is not visible.');
  }
  return box;
}

/** Presses on the handle and travels far enough that dnd-kit starts the drag. */
async function beginDrag(page: Page, handle: Locator): Promise<void> {
  const from = await settledBox(handle);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 4 });
}

async function moveTo(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y, { steps: 12 });
}

/**
 * Moves onto the gap and waits until it reports itself as the drop target. The gaps mount once the drag has
 * started, so the gap is measured here, after the start, on every attempt; small moves inside it repeat the
 * pointer events until the library has picked it.
 */
async function settleOnGap(page: Page, beside: Locator, edge: 'above' | 'below'): Promise<void> {
  await expect(async () => {
    const point = await gapPoint(beside, edge);
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.mouse.move(point.x - 2, point.y, { steps: 2 });
    await page.mouse.move(point.x, point.y, { steps: 2 });
    await expect(page.locator('[data-testid="meal-gap"][data-over="true"]')).toHaveCount(1, { timeout: 500 });
  }).toPass({ timeout: 5000 });
}

/** The point in the gap above (or below) a card, in the card's column. */
async function gapPoint(card: Locator, edge: 'above' | 'below'): Promise<{ x: number; y: number }> {
  const box = await settledBox(card);
  return { x: box.x + box.width / 2, y: edge === 'above' ? box.y - HALF_GAP : box.y + box.height + HALF_GAP };
}

async function dragToGap(page: Page, handle: Locator, beside: Locator, edge: 'above' | 'below'): Promise<void> {
  // Scroll both ends into view first, so reading one box cannot move the other.
  await handle.scrollIntoViewIfNeeded();
  await beside.scrollIntoViewIfNeeded();
  await beginDrag(page, handle);
  await settleOnGap(page, beside, edge);
  await page.mouse.up();
}

async function dragToCell(page: Page, handle: Locator, target: Locator): Promise<void> {
  await handle.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  await beginDrag(page, handle);
  const box = await settledBox(target);
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.up();
}

/** Expects Monday's four cells to hold, in row order, the given numbers of ingredients. */
async function expectMonday(page: Page, counts: readonly number[]): Promise<void> {
  for (const [row, count] of counts.entries()) {
    await expect(cell(page, 1, row)).toContainText(`${count} items`);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Monday ten weeks out, as YYYY-MM-DD: publishable (never in the past) and clear of the other specs' plans. */
function farFutureMonday(): string {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysToNextMonday = (8 - new Date(today).getUTCDay()) % 7 || 7;
  return new Date(today + (daysToNextMonday + 70) * DAY_MS).toISOString().slice(0, 10);
}

async function readVersion(api: Api, headers: Auth, planId: string): Promise<number | undefined> {
  const detail = await api.get(`/nutrition/plans/${planId}`, { headers });
  return ((await detail.json()) as { version?: number }).version;
}

/**
 * A client plan with Monday Breakfast (A) and Lunch (B), made Completed through the API: week 1 is published
 * (POST /nutrition/plans/{PlanId}/weeks/{WeekNumber}/publish with `{ version }`, which needs a start date and
 * makes the plan Active), then POST /nutrition/plans/{PlanId}/complete with `{ version }`. The client editor
 * treats a Completed plan as read-only. DELETE permanently removes a plan that has not started, so the spec
 * deletes it afterwards.
 */
async function createCompletedPlan(baseURL: string, name: string): Promise<string> {
  return withApi(baseURL, async (api, headers) => {
    const food = await findApple(api, headers);
    const startDate = farFutureMonday();
    const created = await api.post('/nutrition/plans', {
      headers,
      data: { clientId: CLIENT_PROFILE_ID, name, weekCount: 1, globalSettings: { dailyKcal: DAILY_KCAL }, startDate },
    });
    if (!created.ok()) {
      throw new Error(`[plan-template-editor-meal-reorder] POST /nutrition/plans returned ${created.status()}: ${await created.text()}`);
    }
    const planId = ((await created.json()) as { planId?: string }).planId;
    if (!planId) {
      throw new Error('[plan-template-editor-meal-reorder] POST /nutrition/plans returned no planId.');
    }
    try {
      const update = await api.put(`/nutrition/plans/${planId}`, {
        headers,
        data: {
          name,
          globalSettings: { dailyKcal: DAILY_KCAL },
          version: await readVersion(api, headers, planId),
          startDate,
          supplements: [],
          weeks: [
            {
              weekNumber: 1,
              days: Array.from({ length: 7 }, (_, dayIndex) => ({
                dayOfWeek: dayIndex + 1,
                meals:
                  dayIndex === 0
                    ? [
                        { kind: 'Breakfast', order: 1, foods: foodsOf(food, COUNTS.a), recipes: [] },
                        { kind: 'Lunch', order: 2, foods: foodsOf(food, COUNTS.b), recipes: [] },
                      ]
                    : [],
              })),
            },
          ],
        },
      });
      if (!update.ok()) {
        throw new Error(`[plan-template-editor-meal-reorder] PUT /nutrition/plans/${planId} returned ${update.status()}: ${await update.text()}`);
      }
      const published = await api.post(`/nutrition/plans/${planId}/weeks/1/publish`, {
        headers,
        data: { version: await readVersion(api, headers, planId) },
      });
      if (!published.ok()) {
        throw new Error(`[plan-template-editor-meal-reorder] publish week 1 returned ${published.status()}: ${await published.text()}`);
      }
      const completed = await api.post(`/nutrition/plans/${planId}/complete`, {
        headers,
        data: { version: await readVersion(api, headers, planId) },
      });
      if (!completed.ok()) {
        throw new Error(`[plan-template-editor-meal-reorder] complete returned ${completed.status()}: ${await completed.text()}`);
      }
    } catch (error) {
      await api.delete(`/nutrition/plans/${planId}`, { headers });
      throw error;
    }
    return planId;
  });
}

async function deletePlan(baseURL: string, planId: string): Promise<void> {
  await withApi(baseURL, (api, headers) => api.delete(`/nutrition/plans/${planId}`, { headers }));
}

const ORIGINAL = [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d];

// Tall enough for Day total and all four meal rows without scrolling: dragging near the scroll area's edge
// would auto-scroll it and move the gaps away from the pointer.
test.use({ viewport: { width: 1920, height: 1200 } });

test.describe('plan editor meal reorder', () => {
  test('dragging Dinner into the gap between Breakfast and Lunch shifts the day, and one Undo restores it', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Reorder Week ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, ORIGINAL);

      await dragToGap(page, cell(page, 1, 3), cell(page, 1, 1), 'above');
      // Mon A B C D -> A D B C: Lunch D, Snack 2 B, Dinner C.
      await expectMonday(page, [COUNTS.a, COUNTS.d, COUNTS.b, COUNTS.c]);
      await expect(page.getByTestId('card-drop-dialog')).toHaveCount(0);
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');

      await page.getByRole('button', { name: 'Undo' }).click();
      await expectMonday(page, ORIGINAL);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('the edge gaps move a meal to the first and to the last slot of its day', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Reorder Edges ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, ORIGINAL);

      await dragToGap(page, cell(page, 1, 2), cell(page, 1, 0), 'above');
      await expectMonday(page, [COUNTS.c, COUNTS.a, COUNTS.b, COUNTS.d]);
      await page.getByRole('button', { name: 'Undo' }).click();
      await expectMonday(page, ORIGINAL);

      await dragToGap(page, cell(page, 1, 0), cell(page, 1, 3), 'below');
      await expectMonday(page, [COUNTS.b, COUNTS.c, COUNTS.d, COUNTS.a]);
      await page.getByRole('button', { name: 'Undo' }).click();
      await expectMonday(page, ORIGINAL);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a kind the day does not have is skipped and never created', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    // Monday has no Snack 2; the other days keep it, so the row exists in the grid.
    const templateId = await createTemplate(origin, `QA Reorder Skip ${Date.now()}`, {
      kindsOf: (dayIndex) => (dayIndex === 0 ? ['Breakfast', 'Lunch', 'Dinner'] : FOUR_KINDS),
      counts: mondayCounts({ Breakfast: COUNTS.a, Lunch: COUNTS.b, Dinner: COUNTS.c }),
    });
    try {
      await page.goto(`/plan-templates/${templateId}`);

      await dragToGap(page, cell(page, 1, 3), cell(page, 1, 1), 'above');
      // Monday's Breakfast, Lunch and Dinner hold A, B, C: now A, C, B. The Snack 2 row stays empty.
      await expect(cell(page, 1, 0)).toContainText(`${COUNTS.a} items`);
      await expect(cell(page, 1, 1)).toContainText(`${COUNTS.c} items`);
      await expect(cell(page, 1, 3)).toContainText(`${COUNTS.b} items`);
      await expect(cell(page, 1, 2)).toContainText('Empty');

      await page.getByRole('button', { name: 'Day', exact: true }).click();
      await expect(page.getByTestId('meal-block')).toHaveCount(3);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('while a card is dragged the gaps show an indicator, the insert lines are hidden, and the gaps next to it are off', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Reorder Indicator ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, ORIGINAL);
      await expect(page.getByTestId('meal-gap')).toHaveCount(0);

      await beginDrag(page, cell(page, 1, 3));
      await expect(page.getByTestId('meal-insert-line')).toHaveCount(0);
      // Dinner is the last slot: gaps 0, 1 and 2 are live; the ones above and below Dinner would change nothing.
      await expect(page.locator('[data-testid="meal-gap"][data-day="1"]')).toHaveCount(3);
      await expect(page.locator('[data-testid="meal-gap"][data-day="2"]')).toHaveCount(0);

      await settleOnGap(page, cell(page, 1, 1), 'above');
      const over = page.locator('[data-testid="meal-gap"][data-over="true"]');
      await expect(over).toHaveCount(1);
      await expect(over.getByTestId('meal-gap-indicator')).toHaveCSS('opacity', '1');

      await page.mouse.up();
      await expect(page.getByTestId('meal-gap')).toHaveCount(0);
      await expect(page.getByTestId('meal-insert-line')).toHaveCount(3);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a card dropped on a filled tile of the same row on another day swaps with it, no dialog, one Undo', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Reorder Swap ${Date.now()}`, {
      counts: (dayIndex, kind) => (kind === 'Breakfast' && dayIndex < 2 ? (dayIndex === 0 ? COUNTS.a : COUNTS.b) : 0),
    });
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expect(cell(page, 1, 0)).toContainText(`${COUNTS.a} items`);
      await expect(cell(page, 2, 0)).toContainText(`${COUNTS.b} items`);

      await dragToCell(page, cell(page, 1, 0), cell(page, 2, 0));
      await expect(page.getByTestId('card-drop-dialog')).toHaveCount(0);
      await expect(cell(page, 1, 0)).toContainText(`${COUNTS.b} items`);
      await expect(cell(page, 2, 0)).toContainText(`${COUNTS.a} items`);
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');

      await page.getByRole('button', { name: 'Undo' }).click();
      await expect(cell(page, 1, 0)).toContainText(`${COUNTS.a} items`);
      await expect(cell(page, 2, 0)).toContainText(`${COUNTS.b} items`);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('the Day view moves a meal into the gap between two meals, and one Undo restores it', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Reorder Day ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, ORIGINAL);
      await page.getByRole('button', { name: 'Day', exact: true }).click();

      const blocks = page.getByTestId('meal-block');
      await expect(blocks).toHaveCount(4);
      const itemCounts = async () => [
        await blocks.nth(0).getByTestId('meal-item').count(),
        await blocks.nth(1).getByTestId('meal-item').count(),
        await blocks.nth(2).getByTestId('meal-item').count(),
        await blocks.nth(3).getByTestId('meal-item').count(),
      ];
      await expect.poll(itemCounts).toEqual(ORIGINAL);

      await dragToGap(page, blocks.nth(3).getByRole('heading'), blocks.nth(1), 'above');
      await expect.poll(itemCounts).toEqual([COUNTS.a, COUNTS.d, COUNTS.b, COUNTS.c]);
      await expect(page.getByTestId('card-drop-dialog')).toHaveCount(0);

      await page.getByRole('button', { name: 'Undo' }).click();
      await expect.poll(itemCounts).toEqual(ORIGINAL);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('Alt+ArrowUp and Alt+ArrowDown move a focused meal one slot, announce it, keep focus, and stop at the ends', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Reorder Keys ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, ORIGINAL);
      const announcer = page.getByTestId('plan-editor-announcer');
      await expect(cell(page, 1, 3)).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');

      await cell(page, 1, 3).focus();
      await page.keyboard.press('Alt+ArrowUp');
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.d, COUNTS.c]);
      await expect(cell(page, 1, 2)).toBeFocused();
      await expect(announcer).toHaveText('Monday: contents moved to Snack, meal 3 of 4');

      // One Undo takes back the one move.
      await page.getByRole('button', { name: 'Undo' }).click();
      await expectMonday(page, ORIGINAL);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');

      // At the last slot Alt+ArrowDown does nothing: no edit, no new announcement.
      await cell(page, 1, 3).focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expectMonday(page, ORIGINAL);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
      await expect(announcer).toHaveText('Monday: contents moved to Snack, meal 3 of 4');

      // The first slot moves down, and focus follows.
      await cell(page, 1, 0).focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expectMonday(page, [COUNTS.b, COUNTS.a, COUNTS.c, COUNTS.d]);
      await expect(cell(page, 1, 1)).toBeFocused();
      await expect(announcer).toHaveText('Monday: contents moved to Lunch, meal 2 of 4');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('the Day view meal cards move with Alt+Arrow too', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Reorder Day Keys ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, ORIGINAL);
      await page.getByRole('button', { name: 'Day', exact: true }).click();

      const blocks = page.getByTestId('meal-block');
      await expect(blocks).toHaveCount(4);
      await blocks.nth(0).focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expect(blocks.nth(0).getByTestId('meal-item')).toHaveCount(COUNTS.b);
      await expect(blocks.nth(1).getByTestId('meal-item')).toHaveCount(COUNTS.a);
      await expect(blocks.nth(1)).toBeFocused();
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a completed client plan is read-only: no gaps, no insert lines, no move shortcuts', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const planId = await createCompletedPlan(origin, `QA ReorderRO ${Date.now()}`);
    try {
      await page.goto(`/clients/${CLIENT_PROFILE_ID}/nutrition/plans/${planId}`);
      await expect(page.getByRole('note')).toBeVisible();
      await expectMonday(page, [COUNTS.a, COUNTS.b]);

      await expect(page.getByTestId('add-meal-week')).toHaveCount(0);
      await expect(page.getByTestId('meal-insert-line')).toHaveCount(0);
      await expect(page.locator('[aria-keyshortcuts]')).toHaveCount(0);

      // Dragging is off, so no gap ever appears, and Alt+Arrow moves nothing.
      await beginDrag(page, cell(page, 1, 1));
      await expect(page.getByTestId('meal-gap')).toHaveCount(0);
      await page.mouse.up();
      await cell(page, 1, 1).focus();
      await page.keyboard.press('Alt+ArrowUp');
      await expectMonday(page, [COUNTS.a, COUNTS.b]);
    } finally {
      await deletePlan(origin, planId);
    }
  });
});
