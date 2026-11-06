/**
 * Locked meals in the client plan editor's Day view (epic #1946): the past-day banner, "Add meal" off on a past
 * day, tick vs empty ring per item, the eaten kcal in the day total, the notice on a conflicted card with its
 * Changed / Added / Removed tags, "Mark reviewed" hiding only the notice, an eaten-but-removed meal that stays,
 * and the save-time lock 409 on a day card.
 *
 * The plan is real (created through the API, never published, stored without a start date). The editor is served
 * that plan with a start date, today's date and the lock verdicts patched in (the fixture has no client activity),
 * and the conflicts list and the review calls are stubbed at the network layer. One plan serves the whole file,
 * which therefore runs serially.
 */
import { request as apiRequest, type APIRequestContext, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@formup.test';
const CLIENT_PROFILE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PLAN_NAME = 'QA DayLocks';
const DAY_MS = 24 * 60 * 60 * 1000;
const BANANA_ITEM_ID = 'cccccccc-0000-0000-0000-000000000001';
const ALMOND_ITEM_ID = 'cccccccc-0000-0000-0000-000000000002';
const GHOST_MEAL_ID = '22222222-2222-2222-2222-222222222222';

interface Food {
  foodId: string;
  name: string;
  nutrientValue: Record<string, number | null>;
}

interface Fixture {
  planId: string;
  mealId: string;
  foodItemId: string;
  food: Food;
}

interface Stub {
  /** The Monday of week 1, as YYYY-MM-DD: in the past for the locked days, far ahead for the editable ones. */
  startDate: string;
  locks: Record<string, unknown>[];
  /** Unreviewed conflicts the list answers with; null answers 403. */
  conflicts: Record<string, unknown>[] | null;
  /** Status the review call answers with; 204 removes the conflict from the list. */
  reviewStatus: number;
  /** Save answers: the lock 409 once, then success. */
  rejectSaveOnce: boolean;
  saves: number;
}

function mondayOfThisWeek(): number {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS;
}

/** A Monday a week ago: every day of week 1 is before today. */
function pastStart(): string {
  return new Date(mondayOfThisWeek() - 7 * DAY_MS).toISOString().slice(0, 10);
}

/** A Monday twelve weeks ahead: nothing is past or eaten. */
function futureStart(): string {
  return new Date(mondayOfThisWeek() + 12 * 7 * DAY_MS).toISOString().slice(0, 10);
}

function dayAfter(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

async function withApi<T>(baseURL: string, work: (api: APIRequestContext) => Promise<T>): Promise<T> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[plan-editor-day-locks] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test.');
  }
  const anonymous = await apiRequest.newContext({ baseURL });
  let accessToken: string;
  try {
    const login = await anonymous.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    accessToken = ((await login.json()) as { accessToken: string }).accessToken;
  } finally {
    await anonymous.dispose();
  }
  const api = await apiRequest.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } });
  try {
    return await work(api);
  } finally {
    await api.dispose();
  }
}

/** Archives the plans of an earlier crashed run. */
async function archiveLeftovers(api: APIRequestContext): Promise<void> {
  const list = await api.get(`/trainer/clients/${CLIENT_PROFILE_ID}/plans`);
  const { plans = [] } = (await list.json()) as { plans?: { planId: string; name: string; status: string }[] };
  for (const plan of plans) {
    if (plan.name.startsWith(PLAN_NAME) && plan.status !== 'Archived') {
      await api.delete(`/nutrition/plans/${plan.planId}`);
    }
  }
}

/** Creates a one-week draft plan with one Breakfast (one food, 100 g) on Monday. */
async function createPlan(baseURL: string): Promise<Fixture> {
  return withApi(baseURL, async (api) => {
    await archiveLeftovers(api);
    const search = await api.get('/foods/search?q=Apple');
    const found = ((await search.json()) as { foods?: Partial<Food & { foodId: string }>[] }).foods?.find(
      (food) => food.foodId && food.name && food.nutrientValue,
    );
    if (!found?.foodId || !found.name || !found.nutrientValue) {
      throw new Error('[plan-editor-day-locks] GET /foods/search?q=Apple returned no food.');
    }
    const food: Food = { foodId: found.foodId, name: found.name, nutrientValue: found.nutrientValue };

    const created = await api.post('/nutrition/plans', {
      data: { clientId: CLIENT_PROFILE_ID, name: PLAN_NAME, weekCount: 1, globalSettings: { dailyKcal: 2000 } },
    });
    if (!created.ok()) {
      throw new Error(`[plan-editor-day-locks] POST /nutrition/plans returned ${created.status()}: ${await created.text()}`);
    }
    const planId = ((await created.json()) as { planId: string }).planId;
    try {
      const detail = await api.get(`/nutrition/plans/${planId}`);
      const { version } = (await detail.json()) as { version?: number };
      const update = await api.put(`/nutrition/plans/${planId}`, {
        data: {
          name: PLAN_NAME,
          globalSettings: { dailyKcal: 2000 },
          version,
          supplements: [],
          weeks: [
            {
              weekNumber: 1,
              days: Array.from({ length: 7 }, (_, dayIndex) => ({
                dayOfWeek: dayIndex + 1,
                meals:
                  dayIndex === 0
                    ? [
                        {
                          kind: 'Breakfast',
                          order: 1,
                          foods: [
                            {
                              foodExternalId: food.foodId,
                              foodName: food.name,
                              nutrientValuePer100Grams: food.nutrientValue,
                              amountGrams: 100,
                            },
                          ],
                          recipes: [],
                        },
                      ]
                    : [],
              })),
            },
          ],
        },
      });
      if (!update.ok()) {
        throw new Error(`[plan-editor-day-locks] PUT /nutrition/plans/${planId} returned ${update.status()}: ${await update.text()}`);
      }
      const saved = await api.get(`/nutrition/plans/${planId}`);
      const body = (await saved.json()) as {
        weeks?: { days: { dayOfWeek: number; meals: { mealId?: string; foods?: { itemId?: string }[] }[] }[] }[];
      };
      const meal = body.weeks?.[0]?.days.find((day) => day.dayOfWeek === 1)?.meals[0];
      if (!meal?.mealId || !meal.foods?.[0]?.itemId) {
        throw new Error('[plan-editor-day-locks] the saved plan has no meal or food item id.');
      }
      return { planId, mealId: meal.mealId, foodItemId: meal.foods[0].itemId, food };
    } catch (error) {
      await api.delete(`/nutrition/plans/${planId}`);
      throw error;
    }
  });
}

/** The lock verdict of the plan's Monday breakfast. `over` replaces any field. */
function mealLock(fixture: Fixture, stub: { startDate: string }, over: Record<string, unknown>): Record<string, unknown> {
  return {
    mealId: fixture.mealId,
    weekNumber: 1,
    dayOfWeek: 1,
    date: stub.startDate,
    isLocked: true,
    lockState: 'Eaten',
    isRemovedFromPlan: false,
    mealKind: 'Breakfast',
    eatenItemIds: [fixture.foodItemId, BANANA_ITEM_ID],
    eatenSnapshot: [
      { itemId: fixture.foodItemId, kind: 'Food', refId: fixture.food.foodId, name: fixture.food.name, amount: 150, kcal: 80 },
      { itemId: BANANA_ITEM_ID, kind: 'Food', refId: '11111111-1111-1111-1111-111111111111', name: 'Banana', amount: 120, kcal: 107 },
    ],
    ...over,
  };
}

/** The Monday breakfast eaten offline while the coach changed the apple and removed the banana. */
function conflictedLock(fixture: Fixture, stub: { startDate: string }): Record<string, unknown> {
  return mealLock(fixture, stub, {
    conflict: {
      conflictId: 'c-1',
      kind: 'PlanChanged',
      basedOnPlanVersion: 4,
      currentPlanVersion: 6,
      reviewed: false,
      itemTags: [
        { itemId: fixture.foodItemId, tag: 'Changed' },
        { itemId: BANANA_ITEM_ID, tag: 'Removed' },
      ],
    },
  });
}

/** The Tuesday snack the client ate offline and the coach then removed from the plan. */
function removedLock(startDate: string): Record<string, unknown> {
  return {
    mealId: GHOST_MEAL_ID,
    weekNumber: 1,
    dayOfWeek: 2,
    date: dayAfter(startDate),
    isLocked: true,
    lockState: 'Eaten',
    isRemovedFromPlan: true,
    mealKind: 'AfternoonSnack',
    eatenItemIds: [ALMOND_ITEM_ID],
    eatenSnapshot: [
      { itemId: ALMOND_ITEM_ID, kind: 'Food', refId: '33333333-3333-3333-3333-333333333333', name: 'Almonds', amount: 30, kcal: 130 },
    ],
    conflict: {
      conflictId: 'c-ghost',
      kind: 'MealRemoved',
      basedOnPlanVersion: 4,
      currentPlanVersion: 6,
      reviewed: false,
      itemTags: [{ itemId: ALMOND_ITEM_ID, tag: 'Removed' }],
    },
  };
}

function listedConflict(fixture: Fixture, stub: { startDate: string }, over: Record<string, unknown>): Record<string, unknown> {
  return {
    conflictId: 'c-1',
    planId: fixture.planId,
    planName: PLAN_NAME,
    operation: 'LogMealEaten',
    kind: 'PlanChanged',
    mealId: fixture.mealId,
    mealKind: 'Breakfast',
    mealLogged: true,
    occurredAt: `${stub.startDate}T09:40:00Z`,
    logDate: stub.startDate,
    basedOnPlanVersion: 4,
    currentPlanVersion: 6,
    detectedAt: new Date().toISOString(),
    ...over,
  };
}

function newStub(over: Partial<Stub>): Stub {
  return {
    startDate: pastStart(),
    locks: [],
    conflicts: [],
    reviewStatus: 204,
    rejectSaveOnce: false,
    saves: 0,
    ...over,
  };
}

/** Routes the plan (served with start date, today and the lock verdicts), the conflicts list, the review call and the save. */
async function installStub(page: Page, stub: Stub, fixture: Fixture): Promise<void> {
  let lastPlan: Record<string, unknown> = {};
  await page.route(new RegExp(`/nutrition/plans/${fixture.planId}$`), async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    if (resourceType !== 'fetch' && resourceType !== 'xhr') {
      return route.fallback();
    }
    if (request.method() === 'PUT') {
      stub.saves += 1;
      if (stub.rejectSaveOnce && stub.saves === 1) {
        return route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          json: { title: 'Locked', status: 409, errorCode: 'MEAL_LOCKED', mealId: fixture.mealId, weekNumber: 1, dayOfWeek: 1 },
        });
      }
      return route.fulfill({ json: { ...lastPlan, version: Number(lastPlan['version'] ?? 1) + stub.saves } });
    }
    if (request.method() !== 'GET') {
      return route.fallback();
    }
    const response = await route.fetch();
    const plan = (await response.json()) as Record<string, unknown>;
    lastPlan = {
      ...plan,
      startDate: stub.startDate,
      clientToday: new Date().toISOString().slice(0, 10),
      mealLocks: stub.locks,
    };
    return route.fulfill({ response, json: lastPlan });
  });
  await page.route('**/trainer/clients/*/offline-sync-conflicts*', (route, request) => {
    if (request.method() !== 'GET') {
      return route.fallback();
    }
    return stub.conflicts === null
      ? route.fulfill({ status: 403, json: { title: 'Forbidden' } })
      : route.fulfill({ json: { items: stub.conflicts } });
  });
  await page.route('**/trainer/clients/*/offline-sync-conflicts/*/review', (route) => {
    const conflictId = route.request().url().split('/').at(-2) ?? '';
    if (stub.reviewStatus !== 204) {
      return route.fulfill({ status: stub.reviewStatus, json: { title: 'boom' } });
    }
    stub.conflicts = (stub.conflicts ?? []).filter((item) => item['conflictId'] !== conflictId);
    return route.fulfill({ status: 204 });
  });
}

async function openDayView(page: Page, fixture: Fixture, day: 'Mon' | 'Tue'): Promise<void> {
  await page.goto(`/clients/${CLIENT_PROFILE_ID}/nutrition/plans/${fixture.planId}`);
  await expect(page.getByRole('heading', { name: PLAN_NAME })).toBeAttached();
  await expect(page.getByTestId('meal-cell').first()).toBeVisible();
  await page.getByRole('group', { name: 'Range' }).getByRole('button', { name: 'Day', exact: true }).click();
  await page.getByRole('tab', { name: new RegExp(`^${day}`) }).click();
  await expect(page.getByTestId('day-view')).toBeVisible();
}

test.describe('plan editor Day view: locked meals', () => {
  test.describe.configure({ mode: 'serial' });

  let fixture: Fixture;
  let origin: string;

  test.beforeAll(async ({ baseURL }) => {
    origin = baseURL ?? 'http://localhost:5173';
    fixture = await createPlan(origin);
  });

  test.afterAll(async () => {
    if (fixture) {
      await withApi(origin, (api) => api.delete(`/nutrition/plans/${fixture.planId}`));
    }
  });

  test('a past day is read-only: banner, Add meal off, tick vs ring, eaten kcal, nothing planned', async ({ page }) => {
    const stub = newStub({});
    stub.locks = [mealLock(fixture, stub, { lockState: 'PartlyEaten', eatenItemIds: [fixture.foodItemId] })];
    await installStub(page, stub, fixture);
    await openDayView(page, fixture, 'Mon');

    const banner = page.getByTestId('day-past-banner');
    await expect(banner).toContainText('is in the past');
    // The formatted date already names the weekday, so the banner names it exactly once.
    expect((await banner.innerText()).match(/\bMon(day)?\b/g)).toHaveLength(1);
    // A past day's tab carries a lock, like the week view's header.
    await expect(page.getByRole('tab', { name: /^Mon/ }).getByTestId('day-tab-lock')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Tue/ }).getByTestId('day-tab-lock')).toBeVisible();
    const addMeal = page.getByTestId('day-add-meal');
    await expect(addMeal).toBeDisabled();
    await expect(addMeal).toHaveAttribute('title', "Meals can't be added to a day that has passed.");

    const card = page.getByTestId('meal-block');
    await expect(card).toHaveAttribute('data-lock', 'PartlyEaten');
    const items = card.getByTestId('meal-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute('data-eaten', 'true');
    await expect(items.nth(1)).toHaveAttribute('data-eaten', 'false');
    // Locked: no amount boxes, no remove buttons, no note field; and a partly eaten meal carries no time line.
    await expect(card.getByRole('textbox')).toHaveCount(0);
    await expect(card.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
    await expect(card.getByTestId('meal-eaten-at')).toHaveCount(0);
    // Only the ticked apple counts: 80 kcal, not the 187 of the whole snapshot.
    await expect(page.getByTestId('day-eaten')).toContainText('Eaten 80 kcal');

    await page.getByRole('tab', { name: /^Tue/ }).click();
    await expect(page.getByTestId('day-past-banner')).toBeVisible();
    await expect(page.getByTestId('day-nothing-planned')).toContainText('Nothing planned');
    await expect(page.getByTestId('day-add-meal')).toBeDisabled();
  });

  test('a locked week tile shows the eaten kcal after its chip', async ({ page }) => {
    const stub = newStub({});
    stub.locks = [mealLock(fixture, stub, { lockState: 'PartlyEaten', eatenItemIds: [fixture.foodItemId] })];
    await installStub(page, stub, fixture);
    await page.goto(`/clients/${CLIENT_PROFILE_ID}/nutrition/plans/${fixture.planId}`);
    await expect(page.getByRole('heading', { name: PLAN_NAME })).toBeAttached();

    const tile = page.getByTestId('meal-cell').filter({ has: page.getByTestId('meal-lock-chip') });
    await expect(tile).toHaveCount(1);
    // Only the ticked apple counts (80 kcal), not the 187 of the whole snapshot.
    await expect(tile).toContainText('80 kcal');
  });

  test("today's tab reads Today and the days before it carry a lock", async ({ page }) => {
    const now = new Date();
    const isoWeekday = ((now.getUTCDay() + 6) % 7) + 1;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (isoWeekday - 1)));
    const stub = newStub({ startDate: monday.toISOString().slice(0, 10) });
    await installStub(page, stub, fixture);
    await openDayView(page, fixture, 'Mon');

    await expect(page.getByTestId('day-tab-today')).toHaveCount(1);
    await expect(page.getByTestId('day-tab-today')).toContainText('Today');
    await expect(page.getByTestId('day-tab-lock')).toHaveCount(isoWeekday - 1);
  });

  test('the notice on a conflicted card lists the plan items with their tags; Mark reviewed hides only the notice', async ({ page }) => {
    const stub = newStub({});
    stub.locks = [conflictedLock(fixture, stub)];
    stub.conflicts = [listedConflict(fixture, stub, {})];
    await installStub(page, stub, fixture);
    await openDayView(page, fixture, 'Mon');

    const card = page.getByTestId('meal-block');
    // The card shows what the client ate (the snapshot), including the banana the coach removed.
    await expect(card.getByTestId('meal-item')).toHaveCount(2);
    await expect(card.getByTestId('meal-conflict-chip')).toBeVisible();
    await expect(page.getByTestId('day-eaten')).toContainText('Eaten 187 kcal');

    const panel = page.getByTestId('sync-conflict-panel');
    const rows = panel.getByTestId('conflict-plan-rows').locator('li');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-status', 'changed');
    await expect(rows.nth(0)).toContainText('Changed');
    await expect(rows.nth(1)).toHaveAttribute('data-status', 'removed');
    await expect(rows.nth(1)).toContainText('Removed');
    await expect(panel.getByTestId('conflict-totals')).toContainText('ate 187 kcal');
    // Each plan row shows amount and kcal; a removed item's name is struck through.
    await expect(rows.nth(0).getByTestId('conflict-item-amount')).toContainText('g');
    await expect(rows.nth(0)).toContainText('kcal');
    await expect(rows.nth(1).getByTestId('conflict-item-name')).toHaveCSS('text-decoration-line', 'line-through');
    // The notice sits below the eaten item rows.
    const itemBox = await card.getByTestId('meal-item').last().boundingBox();
    const panelBox = await panel.boundingBox();
    expect(panelBox?.y ?? 0).toBeGreaterThan((itemBox?.y ?? Infinity) + (itemBox?.height ?? 0) - 1);

    await panel.getByTestId('conflict-mark-reviewed').click();
    await expect(panel).toHaveCount(0);
    await expect(card.getByTestId('meal-conflict-chip')).toHaveCount(0);
    // The meal stays eaten and locked.
    await expect(card).toHaveAttribute('data-lock', 'Eaten');
    await expect(card.getByTestId('meal-item')).toHaveCount(2);
  });

  test('an eaten meal the coach removed stays on its day after Mark reviewed', async ({ page }) => {
    const stub = newStub({});
    stub.locks = [removedLock(stub.startDate)];
    stub.conflicts = [listedConflict(fixture, stub, { conflictId: 'c-ghost', kind: 'MealRemoved', mealId: GHOST_MEAL_ID, mealKind: 'AfternoonSnack', logDate: dayAfter(stub.startDate) })];
    await installStub(page, stub, fixture);
    await openDayView(page, fixture, 'Tue');

    const ghost = page.getByTestId('sync-conflict-ghost-card');
    await expect(ghost).toHaveCount(1);
    await expect(ghost.getByTestId('eaten-item')).toContainText('Almonds');
    await expect(ghost.getByTestId('sync-conflict-panel')).toBeVisible();
    // The removed meal counts toward what the client ate that day.
    await expect(page.getByTestId('day-eaten')).toContainText('Eaten 130 kcal');
    // It is read-only: no controls on it, and it is not a meal of the plan.
    await expect(ghost.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByTestId('meal-block')).toHaveCount(0);

    await ghost.getByTestId('conflict-mark-reviewed').click();
    await expect(ghost.getByTestId('sync-conflict-panel')).toHaveCount(0);
    await expect(ghost).toHaveCount(1);
    await expect(ghost.getByTestId('eaten-item')).toContainText('Almonds');
    await expect(page.getByTestId('day-eaten')).toContainText('Eaten 130 kcal');
  });

  test('a 403 on the conflicts list shows no notice, but locked and removed meals still show as eaten', async ({ page }) => {
    const stub = newStub({ conflicts: null });
    stub.locks = [conflictedLock(fixture, stub), removedLock(stub.startDate)];
    await installStub(page, stub, fixture);
    await openDayView(page, fixture, 'Mon');

    await expect(page.getByTestId('sync-conflict-strip')).toHaveCount(0);
    await expect(page.getByTestId('sync-conflict-panel')).toHaveCount(0);
    const card = page.getByTestId('meal-block');
    await expect(card).toHaveAttribute('data-lock', 'Eaten');
    await expect(card.getByTestId('meal-conflict-chip')).toHaveCount(0);
    await expect(card.getByTestId('meal-item').first()).toHaveAttribute('data-eaten', 'true');

    await page.getByRole('tab', { name: /^Tue/ }).click();
    await expect(page.getByTestId('sync-conflict-ghost-card')).toHaveCount(1);
    await expect(page.getByTestId('sync-conflict-panel')).toHaveCount(0);
    await expect(page.getByTestId('day-eaten')).toContainText('Eaten 130 kcal');
  });

  test('a failed Mark reviewed leaves the notice and shows the error toast', async ({ page }) => {
    const stub = newStub({ reviewStatus: 500 });
    stub.locks = [conflictedLock(fixture, stub)];
    stub.conflicts = [listedConflict(fixture, stub, {})];
    await installStub(page, stub, fixture);
    await openDayView(page, fixture, 'Mon');

    await page.getByTestId('conflict-mark-reviewed').click();
    await expect(page.locator('[data-slot="toast-title"]')).toHaveText("Couldn't mark the conflict as reviewed. Please try again.");
    await expect(page.getByTestId('sync-conflict-panel')).toBeVisible();
    await expect(page.getByTestId('meal-conflict-chip')).toBeVisible();
  });

  test('a lock 409 on save outlines the day card, keeps the edit and clears on the next change', async ({ page }) => {
    const stub = newStub({ startDate: futureStart(), rejectSaveOnce: true });
    await installStub(page, stub, fixture);
    await openDayView(page, fixture, 'Mon');

    const card = page.getByTestId('meal-block');
    const note = card.getByRole('textbox', { name: 'Note for Breakfast' });
    await note.fill('Eat slowly');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('[data-slot="toast-title"]')).toContainText('A meal was eaten or locked while you were editing');
    await expect(card).toHaveAttribute('data-lock-rejected', 'true');
    await expect(card.getByTestId('meal-lock-conflict')).toBeVisible();
    // The edit is still there: no reload, nothing reverted.
    await expect(note).toHaveValue('Eat slowly');

    await note.fill('Eat slowly, please');
    await expect(card).not.toHaveAttribute('data-lock-rejected', 'true');
    await expect(card.getByTestId('meal-lock-conflict')).toHaveCount(0);
  });

  // The live path (the client eats the meal, SignalR refetches the plan, no save) has no trigger the harness can pull
  // without a real client session, so the refetch here comes from the refused save; the flag itself is derived from the
  // refetched locks and the stored copy, not from the 409.
  test('a locked meal with an unsaved edit shows the "!" badge; Restore in its popover puts back what is stored', async ({
    page,
  }) => {
    const stub = newStub({ startDate: futureStart(), rejectSaveOnce: true });
    await installStub(page, stub, fixture);
    await openDayView(page, fixture, 'Mon');

    const card = page.getByTestId('meal-block');
    const note = card.getByRole('textbox', { name: 'Note for Breakfast' });
    await note.fill('Eat slowly');
    stub.locks = [mealLock(fixture, stub, {})];
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    const badge = card.getByTestId('meal-lock-conflict');
    await expect(badge).toBeVisible();
    await badge.click();
    const popover = page.getByTestId('meal-detail');
    await expect(popover.getByTestId('meal-lock-conflict-notice')).toHaveText(
      'The client ate this meal before you saved your changes.',
    );

    await popover.getByTestId('meal-restore').click();
    await expect(page.getByTestId('meal-detail')).toHaveCount(0);
    await expect(badge).toHaveCount(0);
    await expect(card).not.toHaveAttribute('data-lock-rejected', 'true');
  });
});
