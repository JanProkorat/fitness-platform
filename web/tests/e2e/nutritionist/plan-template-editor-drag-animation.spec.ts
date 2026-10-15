/**
 * Plan editor drag animation (epic #1424, task #1439): while a meal tile is dragged within its day the tiles
 * slide to preview the move, the hovered slot is marked (data-landing) and the contents shown while hovering are
 * the ones the drop leaves; holding Alt/Option turns the same drag into a copy (nothing slides); a dragged row
 * or day label lifts a copy of the whole row or column and lights up the whole target band; keyboard moves and
 * drops slide the tiles too. Nothing slides under reduced motion. Runs against the real harness, no mocked APIs.
 *
 * A meal's contents are told apart by how many ingredients it holds (its cell shows "N items"), so Monday's
 * Breakfast, Lunch, Snack 2 and Dinner hold 2, 3, 4 and 5 apples.
 */
import { request as apiRequest, type Locator, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';
const DAILY_KCAL = 2000;
const LOG_TAG = '[plan-template-editor-drag-animation]';
const FOUR_KINDS = ['Breakfast', 'Lunch', 'AfternoonSnack', 'Dinner'];
const COUNTS = { a: 2, b: 3, c: 4, d: 5 };
const MONDAY_COUNTS: Record<string, number> = {
  Breakfast: COUNTS.a,
  Lunch: COUNTS.b,
  AfternoonSnack: COUNTS.c,
  Dinner: COUNTS.d,
};
/** Longer than the 200 ms slide, so a slide that was going to start has started and, without one, nothing is left to wait for. */
const SLIDE_SETTLE_MS = 450;

type Auth = Record<string, string>;
type Api = Awaited<ReturnType<typeof apiRequest.newContext>>;

interface LoginResponseBody {
  accessToken: string;
}

interface CreatedBody {
  templateId?: string;
}

async function withApi<T>(baseURL: string, run: (api: Api, auth: Auth) => Promise<T>): Promise<T> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error(`${LOG_TAG} QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.`);
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const login = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!login.ok()) {
      throw new Error(`${LOG_TAG} login as qa.nutri returned ${login.status()}.`);
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

/** The ingredient every seeded meal holds: found by its exact name, never by list position. */
async function findApple(api: Api, headers: Auth): Promise<Food> {
  const search = await api.get('/foods/search?q=Apple', { headers });
  const foods = ((await search.json()) as FoodsSearchBody).foods ?? [];
  const found = foods.find((food) => food.name?.toLowerCase() === 'apple' && food.foodId && food.nutrientValue);
  if (!found?.foodId || !found.name || !found.nutrientValue) {
    throw new Error(`${LOG_TAG} GET /foods/search?q=Apple returned no food named exactly "Apple".`);
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

/** Monday holds the kinds with the given ingredient counts; every other day holds the same kinds, empty. */
async function createTemplate(
  baseURL: string,
  name: string,
  mondayCounts: Record<string, number> = MONDAY_COUNTS,
): Promise<string> {
  return withApi(baseURL, async (api, headers) => {
    const food = await findApple(api, headers);
    const weeks = [
      {
        weekNumber: 1,
        days: Array.from({ length: 7 }, (_, dayIndex) => ({
          dayOfWeek: dayIndex + 1,
          meals: FOUR_KINDS.map((kind, mealIndex) => ({
            kind,
            order: mealIndex + 1,
            foods: foodsOf(food, dayIndex === 0 ? (mondayCounts[kind] ?? 0) : 0),
            recipes: [],
          })),
        })),
      },
    ];
    const response = await api.post('/nutrition/plan-templates', {
      headers,
      data: { name, goal: 'Maintain', globalSettings: { dailyKcal: DAILY_KCAL }, weeks },
    });
    if (!response.ok()) {
      throw new Error(`${LOG_TAG} POST /nutrition/plan-templates returned ${response.status()}: ${await response.text()}`);
    }
    const templateId = ((await response.json()) as CreatedBody).templateId;
    if (!templateId) {
      throw new Error(`${LOG_TAG} create response carried no templateId.`);
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

function rowLabel(page: Page, rowIndex: number): Locator {
  return page.locator(`[data-testid="row-label"][data-index="${rowIndex}"]`);
}

function rowFrame(page: Page, rowIndex: number): Locator {
  return page.locator(`[data-testid="row-label-frame"][data-index="${rowIndex}"]`);
}

function dayLabel(page: Page, dayOfWeek: number): Locator {
  return page.locator(`[data-testid="day-label"][data-index="${dayOfWeek}"]`);
}

function dayFrame(page: Page, dayOfWeek: number): Locator {
  return page.locator(`[data-testid="day-label-frame"][data-index="${dayOfWeek}"]`);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Scrolls the element into view, then waits until two reads of its box match. */
async function settledBox(locator: Locator): Promise<Box> {
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
    throw new Error(`${LOG_TAG} drag source or target is not visible.`);
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

/**
 * Moves onto the target and waits until `attribute` is set on it. The target is measured once, right after the
 * drag has started: the drag works from the layout it started with, and a Day-view card changes height as the
 * preview slides the contents. Small moves inside the target repeat the pointer events until it is picked up.
 */
async function hoverUntil(page: Page, target: Locator, attribute: string, value: string): Promise<void> {
  const box = await settledBox(target);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 12 });
  await expect(async () => {
    await page.mouse.move(x - 2, y, { steps: 2 });
    await page.mouse.move(x, y, { steps: 2 });
    await expect(target).toHaveAttribute(attribute, value, { timeout: 500 });
  }).toPass({ timeout: 5000 });
}

async function hoverSlot(page: Page, target: Locator): Promise<void> {
  await hoverUntil(page, target, 'data-landing', 'true');
}

/** Starts watching every frame for tile faces that are sliding; the most at once is read back with {@link slidingFaces}. */
async function watchFaces(page: Page): Promise<void> {
  await page.evaluate(() => {
    const recorder = window as unknown as { __slidingFaces?: number };
    recorder.__slidingFaces = 0;
    const tick = () => {
      document.querySelectorAll('[data-flip-key]').forEach((face) => {
        recorder.__slidingFaces = Math.max(recorder.__slidingFaces ?? 0, face.getAnimations().length);
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function slidingFaces(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __slidingFaces?: number }).__slidingFaces ?? 0);
}

async function resetSlidingFaces(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __slidingFaces?: number }).__slidingFaces = 0;
  });
}

/** What Monday's four cells show, in row order. */
async function mondayTexts(page: Page): Promise<string[]> {
  const texts: string[] = [];
  for (const row of [0, 1, 2, 3]) {
    texts.push(await cell(page, 1, row).innerText());
  }
  return texts;
}

/** Expects Monday's four cells to hold, in row order, the given numbers of ingredients. */
async function expectMonday(page: Page, counts: readonly number[]): Promise<void> {
  for (const [row, count] of counts.entries()) {
    await expect(cell(page, 1, row)).toContainText(count === 0 ? 'Empty' : `${count} items`);
  }
}

/** The box of every meal tile, by day and row. */
async function tileBoxes(page: Page): Promise<Record<string, Box>> {
  return page.locator('[data-testid="meal-cell"]').evaluateAll((elements) =>
    Object.fromEntries(
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return [`${element.getAttribute('data-day')}:${element.getAttribute('data-row')}`, { x, y, width, height }];
      }),
    ),
  );
}

/** Every tile's size must match; positions may differ by the 1px lift of the tile under the pointer. */
function expectSameLayout(actual: Record<string, Box>, expected: Record<string, Box>): void {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  for (const [key, box] of Object.entries(expected)) {
    const other = actual[key];
    expect(other, key).toBeDefined();
    expect(Math.abs(other.width - box.width), `${key} width`).toBeLessThan(0.5);
    expect(Math.abs(other.height - box.height), `${key} height`).toBeLessThan(0.5);
    expect(Math.abs(other.x - box.x), `${key} x`).toBeLessThan(1.5);
    expect(Math.abs(other.y - box.y), `${key} y`).toBeLessThan(1.5);
  }
}

async function tileOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid="meal-cell"]')
    .evaluateAll((elements) => elements.map((element) => `${element.getAttribute('data-day')}:${element.getAttribute('data-row')}`));
}

// Tall enough for Day total and all four meal rows without scrolling: dragging near the scroll area's edge
// would auto-scroll it and move the tiles away from the pointer.
test.use({ viewport: { width: 1920, height: 1200 } });

test.describe('plan editor drag animation', () => {
  test('the hovered meal is marked as the landing slot and the contents shown while hovering are the ones the drop leaves', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Anim Preview ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d]);
      await expect(page.locator('[data-landing]')).toHaveCount(0);

      await beginDrag(page, cell(page, 1, 3));
      await expect(page.locator('[data-landing]')).toHaveCount(0);
      await hoverSlot(page, cell(page, 1, 1));
      await expect(page.locator('[data-landing="true"]')).toHaveCount(1);
      await expect(cell(page, 1, 1)).toHaveAttribute('data-landing', 'true');

      // Dinner's contents already sit in Lunch's slot, and the slots below have shifted down by one.
      await expectMonday(page, [COUNTS.a, COUNTS.d, COUNTS.b, COUNTS.c]);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
      await page.waitForTimeout(SLIDE_SETTLE_MS);
      const hovering = await mondayTexts(page);

      await page.mouse.up();
      await expect(page.locator('[data-landing]')).toHaveCount(0);
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');
      await expect.poll(() => mondayTexts(page)).toEqual(hovering);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('the slots keep their order in the page, and no tile changes its box before, during or after a drag', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Anim Layout ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d]);
      await page.mouse.move(2, 2);
      const orderBefore = await tileOrder(page);
      const before = await tileBoxes(page);

      await beginDrag(page, cell(page, 1, 3));
      await hoverSlot(page, cell(page, 1, 0));
      await page.waitForTimeout(SLIDE_SETTLE_MS);
      expectSameLayout(await tileBoxes(page), before);
      expect(await tileOrder(page)).toEqual(orderBefore);

      await page.mouse.up();
      await expectMonday(page, [COUNTS.d, COUNTS.a, COUNTS.b, COUNTS.c]);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(SLIDE_SETTLE_MS);
      expectSameLayout(await tileBoxes(page), before);
      // The slots never moved: the contents did.
      expect(await tileOrder(page)).toEqual(orderBefore);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('the faces slide while the move is previewed, and not under reduced motion', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Anim Slide ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d]);
      await watchFaces(page);

      await beginDrag(page, cell(page, 1, 3));
      await hoverSlot(page, cell(page, 1, 1));
      await expect.poll(() => slidingFaces(page)).toBeGreaterThan(0);
      await page.mouse.up();
      await page.getByRole('button', { name: 'Undo' }).click();
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d]);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');

      // The preference is read when a slide would start, so switching it needs no reload.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(SLIDE_SETTLE_MS);
      await resetSlidingFaces(page);
      await beginDrag(page, cell(page, 1, 3));
      await hoverSlot(page, cell(page, 1, 1));
      await expectMonday(page, [COUNTS.a, COUNTS.d, COUNTS.b, COUNTS.c]);
      await page.waitForTimeout(SLIDE_SETTLE_MS);
      expect(await slidingFaces(page)).toBe(0);
      await page.mouse.up();
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('Alt+Arrow moves slide the faces too, and not under reduced motion', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Anim Keys ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d]);
      await watchFaces(page);

      await cell(page, 1, 3).focus();
      await page.keyboard.press('Alt+ArrowUp');
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.d, COUNTS.c]);
      await expect.poll(() => slidingFaces(page)).toBeGreaterThan(0);

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(SLIDE_SETTLE_MS);
      await resetSlidingFaces(page);
      await cell(page, 1, 2).focus();
      await page.keyboard.press('Alt+ArrowUp');
      await expectMonday(page, [COUNTS.a, COUNTS.d, COUNTS.b, COUNTS.c]);
      await page.waitForTimeout(SLIDE_SETTLE_MS);
      expect(await slidingFaces(page)).toBe(0);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a label drop slides the faces from their old cells to the new ones', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    // Breakfast holds 2 on Monday and nothing elsewhere; Lunch and the snack stay empty, so a row copy asks nothing.
    const templateId = await createTemplate(origin, `QA Anim Label Drop ${Date.now()}`, { Breakfast: COUNTS.a });
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, [COUNTS.a, 0, 0, 0]);
      await watchFaces(page);

      await beginDrag(page, rowLabel(page, 0));
      await hoverUntil(page, rowFrame(page, 2), 'data-over', 'true');
      await page.mouse.up();
      await expectMonday(page, [COUNTS.a, 0, COUNTS.a, 0]);
      await expect.poll(() => slidingFaces(page)).toBeGreaterThan(0);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a dragged row lifts a copy of the whole row, dims the source and lights up the whole target row', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Anim Row Overlay ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d]);
      const sources = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((day) => settledBox(cell(page, day, 0))));

      await beginDrag(page, rowLabel(page, 0));
      const overlay = page.getByTestId('grid-drag-overlay');
      await expect(overlay).toHaveCount(1);
      await expect(overlay).toHaveAttribute('data-axis', 'row');
      const tiles = overlay.locator(':scope > div');
      await expect(tiles).toHaveCount(7);
      // Each tile has the size of the cell it copies, and the row keeps its spacing.
      const copyBoxes = await Promise.all([0, 1, 2, 3, 4, 5, 6].map((index) => settledBox(tiles.nth(index))));
      for (const [index, source] of sources.entries()) {
        expect(Math.abs(copyBoxes[index].width - source.width), `tile ${index} width`).toBeLessThan(1);
        expect(Math.abs(copyBoxes[index].height - source.height), `tile ${index} height`).toBeLessThan(1);
        expect(
          Math.abs(copyBoxes[index].x - copyBoxes[0].x - (source.x - sources[0].x)),
          `tile ${index} offset`,
        ).toBeLessThan(1);
      }
      await expect(tiles.first()).toContainText(`${COUNTS.a} items`);

      // The source row is dimmed; the overlay is not.
      await expect(page.locator('[data-band="source"]')).toHaveCount(7);
      await expect(cell(page, 1, 0)).toHaveCSS('opacity', '0.5');
      await expect(page.locator('[data-band="target"]')).toHaveCount(0);

      // Anywhere in the target row picks it, the label included.
      const over = await settledBox(cell(page, 4, 2));
      await page.mouse.move(over.x + over.width / 2, over.y + over.height / 2, { steps: 12 });
      await expect(page.locator('[data-band="target"]')).toHaveCount(7);
      await expect(cell(page, 1, 2)).toHaveAttribute('data-band', 'target');
      await expect(rowFrame(page, 2)).toHaveAttribute('data-over', 'true');
      await expect(page.locator('[data-band="source"]')).toHaveCount(7);

      await page.mouse.up();
      await expect(page.getByTestId('grid-drag-overlay')).toHaveCount(0);
      await expect(page.locator('[data-band]')).toHaveCount(0);
      await page.getByTestId('label-drop-dialog').getByRole('button', { name: 'Cancel' }).click();
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d]);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('a dragged day lifts a copy of the whole column and lights up the whole target column', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Anim Day Overlay ${Date.now()}`);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, [COUNTS.a, COUNTS.b, COUNTS.c, COUNTS.d]);

      await beginDrag(page, dayLabel(page, 1));
      const overlay = page.getByTestId('grid-drag-overlay');
      await expect(overlay).toHaveAttribute('data-axis', 'day');
      await expect(overlay.locator(':scope > div')).toHaveCount(4);
      await expect(page.locator('[data-band="source"]')).toHaveCount(4);

      // Over a tile of another day: that whole column, its name included, is the target.
      const over = await settledBox(cell(page, 3, 2));
      await page.mouse.move(over.x + over.width / 2, over.y + over.height / 2, { steps: 12 });
      await expect(page.locator('[data-band="target"]')).toHaveCount(4);
      await expect(cell(page, 3, 0)).toHaveAttribute('data-band', 'target');
      await expect(dayFrame(page, 3)).toHaveAttribute('data-over', 'true');

      // Tuesday is empty, so the drop copies at once.
      const tuesday = await settledBox(cell(page, 2, 2));
      await page.mouse.move(tuesday.x + tuesday.width / 2, tuesday.y + tuesday.height / 2, { steps: 12 });
      await expect(cell(page, 2, 0)).toHaveAttribute('data-band', 'target');
      await page.mouse.up();
      await expect(page.getByTestId('label-drop-dialog')).toHaveCount(0);
      await expect(cell(page, 2, 0)).toContainText(`${COUNTS.a} items`);
      await expect(cell(page, 2, 3)).toContainText(`${COUNTS.d} items`);
      await expect(cell(page, 1, 3)).toContainText(`${COUNTS.d} items`);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('holding Alt in the week grid copies instead of moving: nothing slides, the hovered tile is the copy target', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    // Lunch is empty, so it is a slot of the day that a copy can fill.
    const templateId = await createTemplate(origin, `QA Anim Alt Grid ${Date.now()}`, {
      Breakfast: COUNTS.a,
      Lunch: 0,
      AfternoonSnack: COUNTS.c,
      Dinner: COUNTS.d,
    });
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await expectMonday(page, [COUNTS.a, 0, COUNTS.c, COUNTS.d]);

      // Without Alt, hovering a filled tile slides the day.
      await beginDrag(page, cell(page, 1, 3));
      await hoverSlot(page, cell(page, 1, 2));
      await expectMonday(page, [COUNTS.a, 0, COUNTS.d, COUNTS.c]);

      // Alt pressed while the pointer rests: the slide goes back, and the tile is marked as a copy target.
      await page.keyboard.down('Alt');
      await expect(cell(page, 1, 2)).toHaveAttribute('data-drop-target', 'copy');
      await expect(page.locator('[data-landing]')).toHaveCount(0);
      await expectMonday(page, [COUNTS.a, 0, COUNTS.c, COUNTS.d]);

      // Alt released: the slide comes back.
      await page.keyboard.up('Alt');
      await expect(cell(page, 1, 2)).toHaveAttribute('data-landing', 'true');
      await expect(page.locator('[data-drop-target]')).toHaveCount(0);
      await expectMonday(page, [COUNTS.a, 0, COUNTS.d, COUNTS.c]);

      // Dropped with Alt on a filled tile it asks Replace or Add, and nothing has changed yet.
      await page.keyboard.down('Alt');
      await expect(cell(page, 1, 2)).toHaveAttribute('data-drop-target', 'copy');
      await page.mouse.up();
      await page.keyboard.up('Alt');
      const dialog = page.getByTestId('card-drop-dialog');
      await expect(dialog).toBeVisible();
      await expectMonday(page, [COUNTS.a, 0, COUNTS.c, COUNTS.d]);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByTestId('save-status')).toHaveText('Saved');

      // Dropped with Alt on an empty tile it copies at once: the source keeps its contents.
      await page.keyboard.down('Alt');
      await beginDrag(page, cell(page, 1, 3));
      await hoverUntil(page, cell(page, 1, 1), 'data-drop-target', 'copy');
      await expectMonday(page, [COUNTS.a, 0, COUNTS.c, COUNTS.d]);
      await page.mouse.up();
      await page.keyboard.up('Alt');
      await expect(dialog).toHaveCount(0);
      await expectMonday(page, [COUNTS.a, COUNTS.d, COUNTS.c, COUNTS.d]);
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('holding Alt in the Day view copies instead of moving, and releasing it brings the slide back', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Anim Alt Day ${Date.now()}`, {
      Breakfast: COUNTS.a,
      Lunch: 0,
      AfternoonSnack: COUNTS.c,
      Dinner: COUNTS.d,
    });
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await page.getByRole('button', { name: 'Day', exact: true }).click();
      const blocks = page.getByTestId('meal-block');
      await expect(blocks).toHaveCount(4);
      const itemCounts = async () => [
        await blocks.nth(0).getByTestId('meal-item').count(),
        await blocks.nth(1).getByTestId('meal-item').count(),
        await blocks.nth(2).getByTestId('meal-item').count(),
        await blocks.nth(3).getByTestId('meal-item').count(),
      ];
      await expect.poll(itemCounts).toEqual([COUNTS.a, 0, COUNTS.c, COUNTS.d]);

      await beginDrag(page, blocks.nth(3).getByRole('heading'));
      await hoverSlot(page, blocks.nth(2));
      await expect.poll(itemCounts).toEqual([COUNTS.a, 0, COUNTS.d, COUNTS.c]);

      await page.keyboard.down('Alt');
      await expect(blocks.nth(2)).toHaveAttribute('data-drop-target', 'copy');
      await expect(page.locator('[data-landing]')).toHaveCount(0);
      await expect.poll(itemCounts).toEqual([COUNTS.a, 0, COUNTS.c, COUNTS.d]);

      await page.keyboard.up('Alt');
      await expect(blocks.nth(2)).toHaveAttribute('data-landing', 'true');
      await expect.poll(itemCounts).toEqual([COUNTS.a, 0, COUNTS.d, COUNTS.c]);

      // Dropped with Alt on a filled card it asks, on an empty one it copies at once.
      await page.keyboard.down('Alt');
      await expect(blocks.nth(2)).toHaveAttribute('data-drop-target', 'copy');
      await page.mouse.up();
      await page.keyboard.up('Alt');
      const dialog = page.getByTestId('card-drop-dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect.poll(itemCounts).toEqual([COUNTS.a, 0, COUNTS.c, COUNTS.d]);

      await page.keyboard.down('Alt');
      await beginDrag(page, blocks.nth(3).getByRole('heading'));
      await hoverUntil(page, blocks.nth(1), 'data-drop-target', 'copy');
      await page.mouse.up();
      await page.keyboard.up('Alt');
      await expect(dialog).toHaveCount(0);
      await expect.poll(itemCounts).toEqual([COUNTS.a, COUNTS.d, COUNTS.c, COUNTS.d]);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });
});
