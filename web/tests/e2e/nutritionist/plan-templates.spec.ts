/**
 * Plan templates list (epic #1237, task #1239): list columns, the New template
 * drawer (full weeks tree, chronological meal order, no weekCount), validation,
 * search + filters, copy, owner-only delete behind a confirm, the empty state and
 * the not-owned row (both stubbed — the QA seed has neither), and the trainer-only
 * "nutritionists only" state.
 *
 * Lives under nutritionist/ because every plan-template endpoint is
 * Nutritionist-only. The trainer-only test imports `trainerTest` directly —
 * project routing is by file path, not by which fixture a test uses (same
 * pattern as recipes.spec.ts).
 */
import { request as apiRequest } from '@playwright/test';
import { nutritionistTest as test, trainerTest, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';

interface LoginResponseBody {
  accessToken: string;
}

interface CreatedTemplateBody {
  templateId?: string;
}

interface CreateTemplateRequestBody {
  name?: string;
  goal?: string;
  weekCount?: number;
  globalSettings?: { dailyKcal?: number };
  weeks?: {
    weekNumber?: number;
    days?: { dayOfWeek?: number; meals?: { kind?: string; order?: number; foods?: unknown[]; recipes?: unknown[] }[] }[];
  }[];
}

async function loginAsNutritionist(baseURL: string): Promise<string> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[plan-templates] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const response = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!response.ok()) {
      throw new Error(`[plan-templates] login as qa.nutri returned ${response.status()} ${response.statusText()}.`);
    }
    return ((await response.json()) as LoginResponseBody).accessToken;
  } finally {
    await api.dispose();
  }
}

/** Creates a template through the API (a Maintain-goal one by default) and returns its id. */
async function createTemplateViaApi(baseURL: string, name: string, goal: string | null = 'Maintain'): Promise<string> {
  const accessToken = await loginAsNutritionist(baseURL);
  const api = await apiRequest.newContext({ baseURL });
  try {
    const response = await api.post('/nutrition/plan-templates', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name, goal: goal ?? undefined, weekCount: 2 },
    });
    if (!response.ok()) {
      throw new Error(`[plan-templates] POST /nutrition/plan-templates returned ${response.status()}.`);
    }
    const body = (await response.json()) as CreatedTemplateBody;
    if (!body.templateId) {
      throw new Error('[plan-templates] create response carried no templateId.');
    }
    return body.templateId;
  } finally {
    await api.dispose();
  }
}

async function deleteTemplateViaApi(baseURL: string, templateId: string): Promise<void> {
  const accessToken = await loginAsNutritionist(baseURL);
  const api = await apiRequest.newContext({ baseURL });
  try {
    await api.delete(`/nutrition/plan-templates/${templateId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } finally {
    await api.dispose();
  }
}

test.describe('plan templates page', () => {
  test('list shows the columns and a seeded Maintain-goal row with the empty-kcal dash', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const name = `QA Template ${Date.now()}`;
    const templateId = await createTemplateViaApi(origin, name);
    try {
      await page.goto('/plan-templates');
      await expect(page.getByRole('heading', { name: 'Plan templates', exact: true })).toBeVisible();
      await page.getByPlaceholder('Search templates…').fill(name);

      for (const column of ['Template', 'Goal', 'Length', 'Avg per day', 'Meals / day', 'Used by', 'Edited']) {
        await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
      }
      const row = page.getByRole('row').filter({ hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row.getByText('Maintain')).toBeVisible();
      await expect(row.getByText('2 weeks')).toBeVisible();
      // Empty meals mean no average kcal and no meals/day, and nobody uses it yet: three dashes.
      await expect(row.getByText('—')).toHaveCount(3);
      await expect(page.getByText(/Viewing \d+ of \d+/)).toBeVisible();
    } finally {
      await deleteTemplateViaApi(origin, templateId);
    }
  });

  test('create sends the full weeks tree in chronological order and opens the editor page', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const name = `QA Created ${Date.now()}`;
    await page.goto('/plan-templates');
    await page.getByRole('button', { name: 'New template' }).first().click();
    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet.getByRole('heading', { name: 'New template' })).toBeVisible();

    await sheet.getByLabel(/^Name\b/).fill(name);
    await sheet.getByRole('radio', { name: 'Performance' }).click();
    await sheet.getByRole('button', { name: 'More weeks' }).click();
    await expect(sheet.getByTestId('plan-template-weeks-value')).toHaveText('5');
    await sheet.getByRole('button', { name: 'Fewer weeks' }).click();
    await sheet.getByRole('button', { name: 'Fewer weeks' }).click();
    await expect(sheet.getByTestId('plan-template-weeks-value')).toHaveText('3');
    await expect(sheet.getByText('weeks · 21 days')).toBeVisible();
    // Snack 2 (AfternoonSnack) is off by default; turn it on after Dinner is already on.
    await sheet.getByRole('button', { name: 'Snack 2' }).click();
    await sheet.getByLabel(/^Daily calorie target/).fill('2100');

    const createRequest = page.waitForRequest(
      (request) => request.url().endsWith('/nutrition/plan-templates') && request.method() === 'POST',
    );
    await sheet.getByRole('button', { name: 'Create & open editor' }).click();
    const body = (await createRequest).postDataJSON() as CreateTemplateRequestBody;

    expect(body.name).toBe(name);
    expect(body.goal).toBe('Performance');
    expect(body.weekCount).toBeUndefined();
    expect(body.globalSettings?.dailyKcal).toBe(2100);
    expect(body.weeks).toHaveLength(3);
    for (const week of body.weeks ?? []) {
      expect(week.days?.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      for (const day of week.days ?? []) {
        expect(day.meals?.map((meal) => meal.kind)).toEqual([
          'Breakfast',
          'MorningSnack',
          'Lunch',
          'AfternoonSnack',
          'Dinner',
        ]);
        expect(day.meals?.map((meal) => meal.order)).toEqual([1, 2, 3, 4, 5]);
        expect(day.meals?.every((meal) => meal.foods?.length === 0 && meal.recipes?.length === 0)).toBe(true);
      }
    }

    await expect(page).toHaveURL(/\/plan-templates\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name })).toBeVisible();

    const templateId = page.url().split('/').pop() ?? '';
    await deleteTemplateViaApi(origin, templateId);
  });

  test('the drawer blocks an empty name, a missing goal and an empty meal selection', async ({ page }) => {
    await page.goto('/plan-templates');
    await page.getByRole('button', { name: 'New template' }).first().click();
    const sheet = page.locator('[data-slot="sheet-content"]');

    for (const label of ['Breakfast', 'Snack', 'Lunch', 'Dinner']) {
      await sheet.getByRole('button', { name: label, exact: true }).click();
    }
    await sheet.getByRole('button', { name: 'Create & open editor' }).click();

    await expect(sheet.getByText('Enter a name of up to 200 characters.')).toBeVisible();
    await expect(sheet.getByText('Choose a goal.')).toBeVisible();
    await expect(sheet.getByText('Choose at least one meal.')).toBeVisible();
    await expect(page).toHaveURL(/\/plan-templates$/);
  });

  test('search and the Goal filter narrow the list', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const stamp = Date.now();
    const maintainId = await createTemplateViaApi(origin, `QA Filter ${stamp} A`, 'Maintain');
    const performanceId = await createTemplateViaApi(origin, `QA Filter ${stamp} B`, 'Performance');
    try {
      await page.goto('/plan-templates');
      await page.getByPlaceholder('Search templates…').fill(`QA Filter ${stamp}`);
      await expect(page.getByRole('row').filter({ hasText: `QA Filter ${stamp}` })).toHaveCount(2);

      await page.getByRole('button', { name: 'Goal', exact: true }).click();
      await page.getByRole('option', { name: 'Performance' }).click();
      await expect(page).toHaveURL(/goal=Performance/);
      await expect(page.getByRole('row').filter({ hasText: `QA Filter ${stamp}` })).toHaveCount(1);
      await expect(page.getByRole('row').filter({ hasText: `QA Filter ${stamp} B` })).toHaveCount(1);
    } finally {
      await deleteTemplateViaApi(origin, maintainId);
      await deleteTemplateViaApi(origin, performanceId);
    }
  });

  test('copy adds a row and delete removes the owned row only after the confirm', async ({ page, baseURL }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const name = `QA Copy ${Date.now()}`;
    const templateId = await createTemplateViaApi(origin, name);
    try {
      await page.goto('/plan-templates');
      await page.getByPlaceholder('Search templates…').fill(name);
      const rows = page.getByRole('row').filter({ hasText: name });
      await expect(rows).toHaveCount(1);

      const copyResponse = page.waitForResponse(
        (response) => response.url().includes('/copy') && response.request().method() === 'POST',
      );
      await rows.first().getByRole('button', { name: /^Actions for/ }).click();
      await page.getByRole('menuitem', { name: 'Copy' }).click();
      expect((await copyResponse).ok()).toBe(true);
      await expect(rows).toHaveCount(2);

      // Delete one of the two rows: cancelling keeps both, confirming removes one.
      await rows.first().getByRole('button', { name: /^Actions for/ }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Delete template' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(rows).toHaveCount(2);

      await rows.first().getByRole('button', { name: /^Actions for/ }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const deleteResponse = page.waitForResponse(
        (response) => response.request().method() === 'DELETE' && response.url().includes('/nutrition/plan-templates/'),
      );
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      expect((await deleteResponse).ok()).toBe(true);
      await expect(rows).toHaveCount(1);
    } finally {
      await deleteTemplateViaApi(origin, templateId);
      // The remaining row may be the copy — clear it so reruns start clean.
      const accessToken = await loginAsNutritionist(origin);
      const api = await apiRequest.newContext({ baseURL: origin });
      try {
        const search = await api.get(`/nutrition/plan-templates?page=1&pageSize=25&search=${encodeURIComponent(name)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const found = (await search.json()) as { templates?: { templateId?: string }[] };
        for (const leftover of found.templates ?? []) {
          if (leftover.templateId) {
            await api.delete(`/nutrition/plan-templates/${leftover.templateId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
          }
        }
      } finally {
        await api.dispose();
      }
    }
  });
});

test.describe('plan templates stubbed states', () => {
  test('shows the empty state with a create button when the list is empty', async ({ page }) => {
    await page.route('**/nutrition/plan-templates?*', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ templates: [], totalCount: 0, page: 1, pageSize: 25 }),
      });
    });
    await page.goto('/plan-templates');
    await expect(page.getByText('No plan templates yet')).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeVisible();
    for (const filter of ['Goal', 'Length', 'Meals per day', 'In use']) {
      await expect(page.getByRole('button', { name: filter, exact: true })).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'New template' }).last().click();
    await expect(page.locator('[data-slot="sheet-content"]').getByRole('heading', { name: 'New template' })).toBeVisible();
  });

  test('a not-owned row has no Delete, no Set goal and shows dashes for empty values', async ({ page }) => {
    await page.route('**/nutrition/plan-templates?*', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          templates: [
            {
              templateId: '11111111-1111-4111-8111-111111111111',
              name: 'Shared by another coach',
              weekCount: 4,
              avgKcalPerDay: 0,
              usedBy: 0,
              isOwnedByCurrentUser: false,
              dateCreated: '2026-09-01T10:00:00Z',
            },
            {
              templateId: '22222222-2222-4222-8222-222222222222',
              name: 'My goalless template',
              weekCount: 1,
              mealsPerDay: 4,
              avgKcalPerDay: 2100,
              usedBy: 3,
              isOwnedByCurrentUser: true,
              dateCreated: '2026-09-01T10:00:00Z',
            },
          ],
          totalCount: 2,
          page: 1,
          pageSize: 25,
        }),
      });
    });
    await page.goto('/plan-templates');

    const shared = page.getByRole('row').filter({ hasText: 'Shared by another coach' });
    await expect(shared.getByRole('button', { name: '+ Set goal' })).toHaveCount(0);
    await expect(shared.getByText('4 weeks')).toBeVisible();
    await shared.getByRole('button', { name: /^Actions for/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const owned = page.getByRole('row').filter({ hasText: 'My goalless template' });
    await expect(owned.getByText('2,100')).toBeVisible();
    await owned.getByRole('button', { name: '+ Set goal' }).click();
    await expect(page).toHaveURL(/\/plan-templates\/22222222-2222-4222-8222-222222222222$/);
  });
});

trainerTest.describe('plan templates for a trainer-only coach', () => {
  trainerTest('shows a readable nutritionists-only state and sends no list request', async ({ page }) => {
    const listRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/nutrition/plan-templates')) {
        listRequests.push(request.url());
      }
    });
    await page.goto('/plan-templates');
    await expect(page.getByText('Plan templates are available to nutritionists')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New template' })).toHaveCount(0);
    await expect(page.locator('[data-slot="toast-viewport"]').getByRole('status')).toHaveCount(0);
    expect(listRequests).toEqual([]);
  });
});
