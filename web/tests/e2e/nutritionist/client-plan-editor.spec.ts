/**
 * Client plan editor (epic #1337): the shared plan editor hosted for one client's plan at
 * /clients/:clientId/nutrition/plans/:planId. Runs against the real harness, no mocked APIs.
 *
 * - Open the seeded plan from the client detail Nutrition tab (read only: never saved or published).
 * - Edit a meal of a fresh plan, Save, reload and see the edit survive.
 * - Publish week 1 of a fresh, future-dated plan.
 *
 * Every plan the specs create is archived in `finally`, and leftovers of a crashed run are archived
 * before a new one is created. Publishing makes a plan the client's newest Active plan, which
 * client-detail-meal-plan reads, so this file runs in the serial `nutritionist-chat` project after it.
 */
import { request as apiRequest, type APIRequestContext, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';
const CLIENT_PROFILE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SEEDED_PLAN_ID = 'dddddddd-eeee-ffff-0000-111111111111';
const PLAN_NAME_PREFIX = 'QA ClientEditor';
const DAILY_KCAL = 2000;
const INITIAL_GRAMS = 100;
const EDITED_GRAMS = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

interface LoginResponseBody {
  accessToken: string;
}

interface FoodsSearchBody {
  foods?: { foodId?: string; name?: string; nutrientValue?: Record<string, number | null> }[];
}

interface CreatedPlanBody {
  planId?: string;
}

interface PlanDetailBody {
  version?: number;
  weeks?: {
    weekNumber: number;
    status?: string;
    days: { dayOfWeek: number; meals: { foods?: { amountGrams: number }[] }[] }[];
  }[];
}

interface ClientPlansBody {
  plans?: { planId: string; name: string; planType: string; status: string }[];
}

interface Food {
  foodId: string;
  name: string;
  nutrientValue: Record<string, number | null>;
}

/** The Monday three weeks after the next UTC Monday, as YYYY-MM-DD: never in the past, never next to the seeded plan. */
function futureMonday(): string {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysToNextMonday = (8 - new Date(today).getUTCDay()) % 7 || 7;
  return new Date(today + (daysToNextMonday + 21) * DAY_MS).toISOString().slice(0, 10);
}

async function login(baseURL: string): Promise<string> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[client-plan-editor] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const response = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!response.ok()) {
      throw new Error(`[client-plan-editor] login as qa.nutri returned ${response.status()}.`);
    }
    return ((await response.json()) as LoginResponseBody).accessToken;
  } finally {
    await api.dispose();
  }
}

/** Runs `work` with an authenticated API context, disposing it afterwards. */
async function withApi<T>(baseURL: string, work: (api: APIRequestContext) => Promise<T>): Promise<T> {
  const accessToken = await login(baseURL);
  const api = await apiRequest.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } });
  try {
    return await work(api);
  } finally {
    await api.dispose();
  }
}

/** Archives every non-archived "QA ClientEditor" plan of the client, left behind by a crashed run. */
async function archiveLeftovers(api: APIRequestContext): Promise<void> {
  const list = await api.get(`/trainer/clients/${CLIENT_PROFILE_ID}/plans`);
  if (!list.ok()) {
    throw new Error(`[client-plan-editor] GET /trainer/clients/{id}/plans returned ${list.status()}.`);
  }
  const { plans = [] } = (await list.json()) as ClientPlansBody;
  for (const plan of plans) {
    if (plan.planType.toLowerCase().startsWith('nutrition') && plan.name.startsWith(PLAN_NAME_PREFIX) && plan.status !== 'Archived') {
      await api.delete(`/nutrition/plans/${plan.planId}`);
    }
  }
}

async function findFood(api: APIRequestContext): Promise<Food> {
  const search = await api.get('/foods/search?q=Apple');
  const found = ((await search.json()) as FoodsSearchBody).foods?.find((food) => food.foodId && food.name && food.nutrientValue);
  if (!found?.foodId || !found.name || !found.nutrientValue) {
    throw new Error('[client-plan-editor] GET /foods/search?q=Apple returned no food.');
  }
  return { foodId: found.foodId, name: found.name, nutrientValue: found.nutrientValue };
}

/**
 * Creates a one-week plan for the QA client holding one meal with one food on Monday, and returns its id.
 * Without a start date the plan is unranged (no overlap check); with one, it must be a future Monday.
 */
async function createPlan(baseURL: string, purpose: string, startDate?: string): Promise<{ planId: string; name: string; food: Food }> {
  const name = `${PLAN_NAME_PREFIX} ${purpose} ${Date.now()}`;
  return withApi(baseURL, async (api) => {
    await archiveLeftovers(api);
    const food = await findFood(api);

    const created = await api.post('/nutrition/plans', {
      data: {
        clientId: CLIENT_PROFILE_ID,
        name,
        weekCount: 1,
        globalSettings: { dailyKcal: DAILY_KCAL },
        ...(startDate ? { startDate } : {}),
      },
    });
    if (!created.ok()) {
      throw new Error(`[client-plan-editor] POST /nutrition/plans returned ${created.status()}: ${await created.text()}`);
    }
    const planId = ((await created.json()) as CreatedPlanBody).planId;
    if (!planId) {
      throw new Error('[client-plan-editor] POST /nutrition/plans returned no planId.');
    }

    try {
      // Read the version right before the PUT so the optimistic-concurrency check cannot fail.
      const detail = await api.get(`/nutrition/plans/${planId}`);
      const { version } = (await detail.json()) as PlanDetailBody;
      const update = await api.put(`/nutrition/plans/${planId}`, {
        data: {
          name,
          globalSettings: { dailyKcal: DAILY_KCAL },
          version,
          ...(startDate ? { startDate } : {}),
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
                              amountGrams: INITIAL_GRAMS,
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
        throw new Error(`[client-plan-editor] PUT /nutrition/plans/${planId} returned ${update.status()}: ${await update.text()}`);
      }
    } catch (error) {
      await api.delete(`/nutrition/plans/${planId}`);
      throw error;
    }
    return { planId, name, food };
  });
}

/** Archives a plan created by a spec. */
async function archivePlan(baseURL: string, planId: string): Promise<void> {
  await withApi(baseURL, (api) => api.delete(`/nutrition/plans/${planId}`));
}

async function readPlan(baseURL: string, planId: string): Promise<PlanDetailBody> {
  return withApi(baseURL, async (api) => {
    const response = await api.get(`/nutrition/plans/${planId}`);
    if (!response.ok()) {
      throw new Error(`[client-plan-editor] GET /nutrition/plans/${planId} returned ${response.status()}.`);
    }
    return (await response.json()) as PlanDetailBody;
  });
}

function editorUrl(planId: string): string {
  return `/clients/${CLIENT_PROFILE_ID}/nutrition/plans/${planId}`;
}

/** Waits for the editor of a plan with one meal on Monday to be on screen. */
async function expectEditorLoaded(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name })).toBeAttached();
  await expect(page.getByTestId('meal-cell').first()).toBeVisible();
}

test.describe('client plan editor', () => {
  test('"Open editor" on the Nutrition tab opens the seeded plan in the editor', async ({ page }) => {
    await page.goto(`/clients/${CLIENT_PROFILE_ID}/nutrition`);

    const openEditor = page.getByRole('link', { name: 'Open editor' });
    await expect(openEditor).toBeVisible();
    await openEditor.click();

    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_PROFILE_ID}/nutrition/plans/${SEEDED_PLAN_ID}$`));
    await expect(page.getByRole('tablist', { name: 'Weeks' })).toBeVisible();
    await expect(page.getByTestId('save-status')).toBeVisible();
  });

  test('an edited meal is saved and survives a reload', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const { planId, name, food } = await createPlan(origin, 'Save');
    try {
      await page.goto(editorUrl(planId));
      await expectEditorLoaded(page, name);

      const monday = page.locator('[data-testid="meal-cell"][data-day="1"][data-row="0"]');
      await expect(monday).toContainText(food.name);
      await monday.click();

      const item = page.getByTestId('meal-detail').getByTestId('meal-item');
      await expect(item).toHaveCount(1);
      await item.getByLabel(/^Amount of /).fill(String(EDITED_GRAMS));
      await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');

      const put = page.waitForResponse(
        (response) => response.url().includes(`/nutrition/plans/${planId}`) && response.request().method() === 'PUT',
      );
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      expect((await put).ok()).toBe(true);
      await expect(page.getByTestId('save-status')).toHaveText('Saved');

      const stored = await readPlan(origin, planId);
      expect(stored.weeks?.[0]?.days.find((day) => day.dayOfWeek === 1)?.meals[0]?.foods?.[0]?.amountGrams).toBe(EDITED_GRAMS);

      await page.reload();
      await expectEditorLoaded(page, name);
      await page.locator('[data-testid="meal-cell"][data-day="1"][data-row="0"]').click();
      await expect(page.getByTestId('meal-detail').getByTestId('meal-item').getByLabel(/^Amount of /)).toHaveValue(String(EDITED_GRAMS));
    } finally {
      await archivePlan(origin, planId);
    }
  });

  test('the Plan info tab shows the selected week average per day', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const { planId, name } = await createPlan(origin, 'Average');
    try {
      await page.goto(editorUrl(planId));
      await expectEditorLoaded(page, name);
      await page.getByRole('tab', { name: 'Plan info' }).click();

      const card = page.getByTestId('info-week-average');
      await expect(card).toBeVisible();
      await expect(card).toContainText('Week 1 · avg per day');
      await expect(card.getByTestId('info-average-kcal')).toHaveText(/[1-9]/);
      for (const key of ['protein', 'carbs', 'fat', 'fiber']) {
        await expect(card.getByTestId(`info-average-${key}`)).toBeVisible();
      }
    } finally {
      await archivePlan(origin, planId);
    }
  });

  test('"Publish week 1" turns a draft week into a published one', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const { planId, name } = await createPlan(origin, 'Publish', futureMonday());
    try {
      await page.goto(editorUrl(planId));
      await expectEditorLoaded(page, name);

      const weekTab = page.getByRole('tab', { name: /Week 1.*draft/ });
      await expect(weekTab).toBeVisible();

      const publish = page.waitForResponse(
        (response) => response.url().includes(`/nutrition/plans/${planId}`) && response.url().includes('publish') && response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Publish week 1' }).click();
      expect((await publish).ok()).toBe(true);

      await expect(page.getByRole('tab', { name: /Week 1.*published/ })).toBeVisible();

      await page.reload();
      await expectEditorLoaded(page, name);
      await expect(page.getByRole('tab', { name: /Week 1.*published/ })).toBeVisible();
    } finally {
      await archivePlan(origin, planId);
    }
  });
});
