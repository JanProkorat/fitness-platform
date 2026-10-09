/**
 * Plan template editor week and day changes: arrows land on the right week or day, a horizontal
 * trackpad scroll changes the week exactly once per gesture, and reduced motion switches instantly.
 * Runs against the real harness, no mocked APIs.
 */
import { request as apiRequest, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';
const WHEEL_STEP_PX = 30;
const WHEEL_STEPS = 8;

interface LoginResponseBody {
  accessToken: string;
}

interface CreatedBody {
  templateId?: string;
}

async function withApi<T>(
  baseURL: string,
  run: (api: Awaited<ReturnType<typeof apiRequest.newContext>>, auth: Record<string, string>) => Promise<T>,
): Promise<T> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[plan-template-editor-slide] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const login = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!login.ok()) {
      throw new Error(`[plan-template-editor-slide] login as qa.nutri returned ${login.status()}.`);
    }
    const { accessToken } = (await login.json()) as LoginResponseBody;
    return await run(api, { Authorization: `Bearer ${accessToken}` });
  } finally {
    await api.dispose();
  }
}

/** Seven days per week, each with one empty breakfast. */
function buildWeeks(weekCount: number) {
  return Array.from({ length: weekCount }, (_, weekIndex) => ({
    weekNumber: weekIndex + 1,
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      dayOfWeek: dayIndex + 1,
      meals: [{ kind: 'Breakfast', order: 1, foods: [], recipes: [] }],
    })),
  }));
}

async function createTemplate(baseURL: string, name: string, weekCount: number): Promise<string> {
  return withApi(baseURL, async (api, headers) => {
    const response = await api.post('/nutrition/plan-templates', {
      headers,
      data: { name, goal: 'Maintain', globalSettings: { dailyKcal: 2000 }, weeks: buildWeeks(weekCount) },
    });
    if (!response.ok()) {
      throw new Error(`[plan-template-editor-slide] POST /nutrition/plan-templates returned ${response.status()}.`);
    }
    const templateId = ((await response.json()) as CreatedBody).templateId;
    if (!templateId) {
      throw new Error('[plan-template-editor-slide] create response carried no templateId.');
    }
    return templateId;
  });
}

async function deleteTemplate(baseURL: string, templateId: string): Promise<void> {
  await withApi(baseURL, (api, headers) => api.delete(`/nutrition/plan-templates/${templateId}`, { headers }));
}

async function openDayView(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await expect(page.getByTestId('day-view')).toBeVisible();
}

test.describe('plan template editor week and day changes', () => {
  test('the Day view arrows and weekday pills land on the right week and day', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Slide Arrows ${Date.now()}`, 3);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      await openDayView(page);
      await expect(page.getByTestId('day-week-title')).toHaveText('Week 1');

      await page.getByRole('button', { name: 'Next week' }).click();
      await expect(page.getByTestId('day-week-title')).toHaveText('Week 2');
      await page.getByRole('button', { name: 'Next week' }).click();
      await expect(page.getByTestId('day-week-title')).toHaveText('Week 3');
      await expect(page.getByRole('button', { name: 'Next week' })).toBeDisabled();
      await page.getByRole('button', { name: 'Previous week' }).click();
      await expect(page.getByTestId('day-week-title')).toHaveText('Week 2');

      await page.getByRole('tab', { name: /^Thu/ }).click();
      await expect(page.getByRole('tab', { name: /^Thu/ })).toHaveAttribute('aria-selected', 'true');
      await page.getByRole('tab', { name: /^Tue/ }).click();
      await expect(page.getByRole('tab', { name: /^Tue/ })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('day-week-title')).toHaveText('Week 2');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('several small horizontal wheel steps change the week exactly once, and the edges do nothing', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Slide Wheel ${Date.now()}`, 2);
    try {
      await page.goto(`/plan-templates/${templateId}`);
      const week1 = page.getByRole('tab', { name: 'Week 1' });
      const week2 = page.getByRole('tab', { name: 'Week 2' });
      await expect(week1).toHaveAttribute('aria-selected', 'true');
      await page.getByTestId('editor-scroll').hover();

      for (let step = 0; step < WHEEL_STEPS; step += 1) {
        await page.mouse.wheel(WHEEL_STEP_PX, 0);
      }
      await expect(week2).toHaveAttribute('aria-selected', 'true');
      await page.waitForTimeout(400);
      await expect(week2).toHaveAttribute('aria-selected', 'true');

      // Another push in the same direction at the last week is a no-op.
      for (let step = 0; step < WHEEL_STEPS; step += 1) {
        await page.mouse.wheel(WHEEL_STEP_PX, 0);
      }
      await page.waitForTimeout(400);
      await expect(week2).toHaveAttribute('aria-selected', 'true');

      // A fresh gesture the other way goes back one week.
      for (let step = 0; step < WHEEL_STEPS; step += 1) {
        await page.mouse.wheel(-WHEEL_STEP_PX, 0);
      }
      await expect(week1).toHaveAttribute('aria-selected', 'true');
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });

  test('reduced motion changes the week instantly, with no slide', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const templateId = await createTemplate(origin, `QA Slide Reduced ${Date.now()}`, 2);
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/plan-templates/${templateId}`);
      await page.getByRole('tab', { name: 'Week 2' }).click();
      await expect(page.getByRole('tab', { name: 'Week 2' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-slide]')).toHaveCount(0);
    } finally {
      await deleteTemplate(origin, templateId);
    }
  });
});
