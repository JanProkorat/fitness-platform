/**
 * Recipe tags: tag a system recipe through its read-only drawer, then filter
 * the list by the Tags pill. Recipes share the caller's food-tag list.
 *
 * Runs in its own `nutritionist-tags` Playwright project, after the
 * `nutritionist` project. ingredients.spec.ts deletes ALL of qa.nutri's food
 * tags and asserts "No tags yet.", so a test using the same list in parallel
 * would race it both ways. This spec creates one tag through the API and
 * deletes only that tag, by id.
 */
import { request as apiRequest } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';

interface LoginResponseBody {
  accessToken: string;
}

interface FoodTagApiBody {
  tagId?: string;
}

async function loginAsNutritionist(baseURL: string): Promise<string> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[recipe-tags] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const response = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!response.ok()) {
      throw new Error(`[recipe-tags] login as qa.nutri returned ${response.status()} ${response.statusText()}.`);
    }
    return ((await response.json()) as LoginResponseBody).accessToken;
  } finally {
    await api.dispose();
  }
}

/** Creates a food tag for qa.nutri through the API and returns its id. */
async function createTagViaApi(baseURL: string, name: string): Promise<string> {
  const accessToken = await loginAsNutritionist(baseURL);
  const api = await apiRequest.newContext({ baseURL });
  try {
    const response = await api.post('/trainer/food-tags', {
      data: { name, colorHex: '#3b82f6' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok()) {
      throw new Error(`[recipe-tags] POST /trainer/food-tags returned ${response.status()} ${response.statusText()}.`);
    }
    const created = (await response.json()) as FoodTagApiBody;
    if (!created.tagId) {
      throw new Error('[recipe-tags] POST /trainer/food-tags returned no tagId.');
    }
    return created.tagId;
  } finally {
    await api.dispose();
  }
}

async function deleteTagViaApi(baseURL: string, tagId: string): Promise<void> {
  const accessToken = await loginAsNutritionist(baseURL);
  const api = await apiRequest.newContext({ baseURL });
  try {
    await api.delete(`/trainer/food-tags/${tagId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } finally {
    await api.dispose();
  }
}

test.describe('recipe tags', () => {
  let tagId = '';
  let tagName = '';

  test.beforeEach(async ({ baseURL }) => {
    tagName = `QA Recipe Tag ${Date.now()}`;
    tagId = await createTagViaApi(baseURL ?? 'http://localhost:5173', tagName);
  });

  test.afterEach(async ({ baseURL }) => {
    if (tagId) {
      await deleteTagViaApi(baseURL ?? 'http://localhost:5173', tagId);
      tagId = '';
    }
  });

  test('tags a system recipe through its read-only drawer, then filters the list by the tag', async ({ page }) => {
    const popoverContent = page.locator("[data-slot='popover-content']");

    await page.goto('/recipes?owner=System');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Recipes', exact: true })).toBeVisible();
    await page.locator('tbody tr').first().click();

    // Scoped to the sheet: the row behind the non-modal sheet also renders the
    // tag chip once assigned, which would make an unscoped text match ambiguous.
    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(drawer.getByRole('heading', { name: 'Recipe', exact: true })).toBeVisible();
    const nameField = drawer.getByLabel(/^Name\b/);
    await expect(nameField).toBeDisabled();
    const recipeName = await nameField.inputValue();

    await expect(drawer.getByText('My Tags')).toBeVisible();
    await drawer.getByRole('button', { name: 'Assign tags' }).click();
    await expect(popoverContent).toBeVisible();
    const assignResponse = page.waitForResponse(
      (response) => /\/trainer\/recipes\/[^/]+\/tags/.test(response.url()) && response.request().method() === 'PUT',
    );
    await popoverContent.locator('li', { hasText: tagName }).getByRole('checkbox').click();
    expect((await assignResponse).ok()).toBe(true);
    await page.keyboard.press('Escape');
    await expect(drawer.getByText(tagName, { exact: true })).toBeVisible();

    await drawer.locator('[data-slot="sheet-footer"]').getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toHaveCount(0);

    // Filter by the tag: only the tagged recipe remains.
    await page.getByRole('button', { name: 'Tags' }).click();
    await expect(popoverContent).toBeVisible();
    const filterResponse = page.waitForResponse(
      (response) => response.url().includes('/recipes') && response.url().includes(`tagId=${tagId}`),
    );
    await popoverContent.locator('li', { hasText: tagName }).getByRole('checkbox').click();
    await filterResponse;
    await page.waitForURL(/tags=/);
    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText(recipeName);
    await expect(page.locator('tbody tr').first()).toContainText(tagName);
  });
});
