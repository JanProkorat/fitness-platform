/**
 * Offline-sync conflicts in the client plan editor (epic #1814): the strip, the badges, the comparison
 * popover (Week view), the panel inside the meal card (Day view), the ghost of a removed meal, the
 * text-only fallback for a conflict without seen items, and marking conflicts reviewed.
 *
 * The plan is real (created through the API, never published, and stored without a start date so it never
 * appears on the client's plan timeline, which other specs read); the editor is served that plan with a
 * start date patched in. The fixture has no conflicts, so the conflicts list and the review calls are
 * stubbed at the network layer. One plan serves the whole file, which therefore runs serially.
 */
import { request as apiRequest, type APIRequestContext, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';
const CLIENT_PROFILE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PLAN_NAME = 'QA SyncConflicts';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Weeks after the next Monday the editor is told the plan starts. */
const START_OFFSET_WEEKS = 12;

interface Food {
  foodId: string;
  name: string;
  nutrientValue: Record<string, number | null>;
}

interface Fixture {
  planId: string;
  mealId: string;
  /** Start date patched into the plan the editor loads; the stored plan has none. */
  startDate: string;
  /** Version of the stored plan, which the editor shows as "Plan now". */
  version: number;
  food: Food;
}

interface ConflictStub {
  conflicts: Record<string, unknown>[];
  /** Status the review calls answer with; 204 removes the conflict from the list. */
  reviewStatus: number;
  reviewed: string[];
}

/** The Monday `START_OFFSET_WEEKS` weeks after the next UTC Monday, as YYYY-MM-DD. */
function startMonday(): string {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysToNextMonday = (8 - new Date(today).getUTCDay()) % 7 || 7;
  return new Date(today + (daysToNextMonday + START_OFFSET_WEEKS * 7) * DAY_MS).toISOString().slice(0, 10);
}

async function withApi<T>(baseURL: string, work: (api: APIRequestContext) => Promise<T>): Promise<T> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[plan-editor-sync-conflicts] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test.');
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
  const startDate = startMonday();
  return withApi(baseURL, async (api) => {
    await archiveLeftovers(api);
    const search = await api.get('/foods/search?q=Apple');
    const found = ((await search.json()) as { foods?: Partial<Food & { foodId: string }>[] }).foods?.find(
      (food) => food.foodId && food.name && food.nutrientValue,
    );
    if (!found?.foodId || !found.name || !found.nutrientValue) {
      throw new Error('[plan-editor-sync-conflicts] GET /foods/search?q=Apple returned no food.');
    }
    const food: Food = { foodId: found.foodId, name: found.name, nutrientValue: found.nutrientValue };

    const created = await api.post('/nutrition/plans', {
      data: {
        clientId: CLIENT_PROFILE_ID,
        name: PLAN_NAME,
        weekCount: 1,
        globalSettings: { dailyKcal: 2000 },
      },
    });
    if (!created.ok()) {
      throw new Error(`[plan-editor-sync-conflicts] POST /nutrition/plans returned ${created.status()}: ${await created.text()}`);
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
        throw new Error(`[plan-editor-sync-conflicts] PUT /nutrition/plans/${planId} returned ${update.status()}: ${await update.text()}`);
      }
      const saved = await api.get(`/nutrition/plans/${planId}`);
      const body = (await saved.json()) as { version?: number; weeks?: { days: { dayOfWeek: number; meals: { mealId?: string }[] }[] }[] };
      const mealId = body.weeks?.[0]?.days.find((day) => day.dayOfWeek === 1)?.meals[0]?.mealId;
      if (!mealId) {
        throw new Error('[plan-editor-sync-conflicts] the saved plan has no meal id.');
      }
      if (body.version === undefined) {
        throw new Error('[plan-editor-sync-conflicts] the saved plan has no version.');
      }
      return { planId, mealId, startDate, version: body.version, food };
    } catch (error) {
      await api.delete(`/nutrition/plans/${planId}`);
      throw error;
    }
  });
}

/** A conflict on the plan's Monday; `over` replaces any field. */
function conflict(fixture: Fixture, over: Record<string, unknown>): Record<string, unknown> {
  return {
    conflictId: 'c-1',
    planId: fixture.planId,
    planName: PLAN_NAME,
    operation: 'LogMealEaten',
    kind: 'PlanChanged',
    mealId: fixture.mealId,
    mealKind: 'Breakfast',
    mealLogged: true,
    occurredAt: `${fixture.startDate}T09:40:00Z`,
    logDate: fixture.startDate,
    basedOnPlanVersion: 4,
    currentPlanVersion: 6,
    detectedAt: new Date().toISOString(),
    ...over,
  };
}

/** Routes the conflicts list (GET), the review calls (POST) and the plan itself, served with its start date. */
async function installStub(page: Page, stub: ConflictStub, fixture: Fixture): Promise<void> {
  await page.route(new RegExp(`/nutrition/plans/${fixture.planId}$`), async (route) => {
    // The editor page shares this path; only the API call carries the plan JSON.
    const resourceType = route.request().resourceType();
    if (route.request().method() !== 'GET' || (resourceType !== 'fetch' && resourceType !== 'xhr')) {
      return route.fallback();
    }
    const response = await route.fetch();
    const plan = (await response.json()) as Record<string, unknown>;
    return route.fulfill({ response, json: { ...plan, startDate: fixture.startDate } });
  });
  await page.route('**/trainer/clients/*/offline-sync-conflicts*', (route, request) =>
    request.method() === 'GET' ? route.fulfill({ json: { items: stub.conflicts } }) : route.fallback(),
  );
  await page.route('**/trainer/clients/*/offline-sync-conflicts/*/review', (route) => {
    const conflictId = route.request().url().split('/').at(-2) ?? '';
    stub.reviewed.push(conflictId);
    if (stub.reviewStatus !== 204) {
      return route.fulfill({ status: stub.reviewStatus, json: { title: 'boom' } });
    }
    stub.conflicts = stub.conflicts.filter((item) => item['conflictId'] !== conflictId);
    return route.fulfill({ status: 204 });
  });
}

async function openEditor(page: Page, fixture: Fixture): Promise<void> {
  await page.goto(`/clients/${CLIENT_PROFILE_ID}/nutrition/plans/${fixture.planId}`);
  await expect(page.getByRole('heading', { name: PLAN_NAME })).toBeAttached();
  await expect(page.getByTestId('meal-cell').first()).toBeVisible();
}

test.describe('plan editor offline-sync conflicts', () => {
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

  function changedMeal(): Record<string, unknown> {
    return conflict(fixture, {
      seenItems: [
        { kind: 'Food', refId: fixture.food.foodId, name: fixture.food.name, amount: 150, kcal: 80 },
        { kind: 'Food', refId: '11111111-1111-1111-1111-111111111111', name: 'Banana <b>bold</b>', amount: 120, kcal: 107 },
      ],
    });
  }

  test('a changed meal: strip, badges, comparison popover and mark reviewed', async ({ page }) => {
    const stub: ConflictStub = { conflicts: [changedMeal()], reviewStatus: 204, reviewed: [] };
    await installStub(page, stub, fixture);
    await openEditor(page, fixture);

    const strip = page.getByTestId('sync-conflict-strip');
    await expect(strip).toContainText('ate 1 meal offline on an older version of this plan');
    await expect(page.getByRole('tab', { name: /Week 1/ }).getByTestId('sync-conflict-badge')).toBeVisible();
    const tile = page.locator('[data-testid="meal-cell"][data-day="1"][data-row="0"]');
    await expect(tile).toHaveAttribute('data-conflict', 'c-1');
    await expect(tile.getByTestId('sync-conflict-badge')).toBeVisible();

    await tile.click();
    const popover = page.getByTestId('sync-conflict-popover');
    await expect(popover).toBeVisible();
    const saw = popover.getByTestId('conflict-column-saw');
    const now = popover.getByTestId('conflict-column-now');
    await expect(saw).toContainText('v4');
    // "Plan now" is the version of the plan the editor loaded, not the conflict's own currentPlanVersion (6).
    await expect(now).toContainText(`v${fixture.version}`);
    // Client-written names render as plain text: the markup is shown, not interpreted.
    await expect(saw).toContainText('Banana <b>bold</b>');
    await expect(saw).toContainText('Removed');
    await expect(saw).toContainText('150 g');
    await expect(now).toContainText(fixture.food.name);
    await expect(now).toContainText('100 g');

    const review = page.waitForRequest((request) => request.url().endsWith('/offline-sync-conflicts/c-1/review'));
    await popover.getByTestId('conflict-mark-reviewed').click();
    expect((await review).method()).toBe('POST');

    await expect(strip).toHaveCount(0);
    await expect(tile).not.toHaveAttribute('data-conflict', /.+/);
    expect(stub.reviewed).toEqual(['c-1']);
  });

  test('the Day view shows the comparison inside the meal card, with kcal and an Amount chip', async ({ page }) => {
    await installStub(page, { conflicts: [changedMeal()], reviewStatus: 204, reviewed: [] }, fixture);
    await openEditor(page, fixture);

    await page.getByRole('group', { name: 'Range' }).getByRole('button', { name: 'Day', exact: true }).click();
    await page.getByRole('tab', { name: /^Mon/ }).click();

    const panel = page.getByTestId('sync-conflict-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('sync-conflict-strip')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Mon/ }).getByTestId('sync-conflict-badge')).toBeVisible();
    await expect(panel.getByTestId('conflict-column-saw')).toContainText('107 kcal');
    await expect(panel.getByTestId('conflict-column-saw')).toContainText('Removed');
    await expect(panel.getByTestId('conflict-column-now')).toContainText('Amount');
    await expect(panel.getByTestId('conflict-column-now')).toContainText('100 g');
  });

  test('a removed meal shows as a ghost tile in a row of its own and opens the comparison', async ({ page }) => {
    const removed = conflict(fixture, {
      conflictId: 'c-ghost',
      kind: 'MealRemoved',
      mealId: '22222222-2222-2222-2222-222222222222',
      mealKind: 'AfternoonSnack',
      mealLogged: false,
      logDate: new Date(Date.parse(`${fixture.startDate}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10),
      seenItems: [{ kind: 'Food', refId: '33333333-3333-3333-3333-333333333333', name: 'Almonds', amount: 30, kcal: 130 }],
    });
    await installStub(page, { conflicts: [removed], reviewStatus: 204, reviewed: [] }, fixture);
    await openEditor(page, fixture);

    // The plan has no snack row, so the ghost gets one appended after the last row, on Tuesday.
    const ghost = page.getByTestId('sync-conflict-ghost');
    await expect(ghost).toHaveCount(1);
    await expect(ghost).toHaveAttribute('data-day', '2');
    await expect(page.getByTestId('sync-conflict-ghost-row')).toHaveCount(1);
    await expect(page.getByTestId('meal-cell')).toHaveCount(7);

    await ghost.click();
    const popover = page.getByTestId('sync-conflict-popover');
    await expect(popover).toContainText('removed, eaten offline');
    await expect(popover.getByTestId('conflict-column-saw')).toContainText('Almonds');
    await expect(popover.getByTestId('conflict-column-now')).toContainText('—');
  });

  test('a conflict without seen items shows the text only', async ({ page }) => {
    await installStub(page, { conflicts: [conflict(fixture, {})], reviewStatus: 204, reviewed: [] }, fixture);
    await openEditor(page, fixture);

    await page.locator('[data-testid="meal-cell"][data-day="1"][data-row="0"]').click();
    const popover = page.getByTestId('sync-conflict-popover');
    await expect(popover.getByTestId('conflict-text-only')).toContainText('saw version 4');
    await expect(popover.getByTestId('conflict-text-only')).toContainText(`you saved version ${fixture.version}`);
    await expect(popover.getByTestId('conflict-comparison')).toHaveCount(0);
  });

  test('"Show" opens the first conflict and "Mark all reviewed" clears the strip', async ({ page }) => {
    const stub: ConflictStub = { conflicts: [changedMeal()], reviewStatus: 204, reviewed: [] };
    await installStub(page, stub, fixture);
    let reviewAllBody: unknown = null;
    await page.route('**/trainer/clients/*/offline-sync-conflicts/review-all', (route) => {
      reviewAllBody = route.request().postDataJSON();
      stub.conflicts = [];
      return route.fulfill({ json: { reviewedCount: 1 } });
    });
    await openEditor(page, fixture);

    await page.getByTestId('sync-conflict-show').click();
    await expect(page.getByTestId('sync-conflict-popover')).toBeVisible();

    await page.getByTestId('sync-conflict-mark-all').click();
    await expect(page.getByTestId('sync-conflict-strip')).toHaveCount(0);
    expect(reviewAllBody).toEqual({ planId: fixture.planId });
  });

  test('a failed review keeps the conflict visible and shows an error toast', async ({ page }) => {
    const stub: ConflictStub = { conflicts: [changedMeal()], reviewStatus: 500, reviewed: [] };
    await installStub(page, stub, fixture);
    await openEditor(page, fixture);

    await page.locator('[data-testid="meal-cell"][data-day="1"][data-row="0"]').click();
    await page.getByTestId('conflict-mark-reviewed').click();

    await expect(page.getByText("Couldn't mark the conflict as reviewed. Please try again.")).toBeVisible();
    expect(stub.reviewed).toEqual(['c-1']);
    await expect(page.getByTestId('sync-conflict-strip')).toBeVisible();
    await expect(page.getByTestId('sync-conflict-popover')).toBeVisible();
  });
});
