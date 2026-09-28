/**
 * #1115 — Ingredients page: list load, search, tag filter, create/edit/
 * delete a private ingredient, and a read-only system row.
 *
 * Path is deliberately under nutritionist/ — every project in
 * playwright.config.ts matches a role subfolder via testMatch, and
 * create/edit/delete on `/foods` are Nutritionist-only
 * (`CreateFoodEndpoint`/`UpdateFoodEndpoint`/`DeleteFoodEndpoint` all gate on
 * `Roles(AppRoles.Nutritionist)`) — the trainer fixture can read the list but
 * cannot exercise the drawer's write paths.
 */
import { request as apiRequest } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';

interface LoginResponseBody {
  accessToken: string;
}

interface FoodApiBody {
  foodId?: string;
  name?: string;
  rawName?: string;
}

/**
 * Logs in as qa.nutri via a bare API context (same one-off pattern as
 * `nutritionist/inbox-cooperation-events.spec.ts`'s `loginAsClient2`) to
 * create/read a food directly, bypassing the drawer, so the fixture's
 * per-attempt browser session (a separate, unrelated refresh token — see
 * `../fixtures/auth.ts`'s header comment) is never touched by this token.
 */
async function loginAsNutritionist(baseURL: string): Promise<string> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[ingredients] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const response = await api.post('/auth/login', { data: { email: NUTRITIONIST_EMAIL, password } });
    if (!response.ok()) {
      throw new Error(`[ingredients] login as qa.nutri returned ${response.status()} ${response.statusText()}.`);
    }
    return ((await response.json()) as LoginResponseBody).accessToken;
  } finally {
    await api.dispose();
  }
}

test.describe('ingredients page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
  });

  test('list loads with a table and a pagination footer', async ({ page }) => {
    await expect(page.getByText(/Viewing \d+ of \d+/)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Library' })).toBeVisible();
  });

  test('searching filters the list by name and updates the URL', async ({ page }) => {
    // Wait for the actual filtered search response (not just the URL/debounce
    // settling) before reading rows — otherwise rows.count() can be read
    // mid-shrink, while the list still holds unfiltered rows that vanish a
    // moment later as the filtered response renders, and a fixed nth(i) index
    // starts pointing at a row that no longer exists.
    const searchResponse = page.waitForResponse(
      (response) => response.url().includes('/foods/search') && response.url().includes('q=Apple'),
    );
    await page.getByPlaceholder('Search ingredients…').fill('Apple');
    await searchResponse;
    await page.waitForURL(/q=Apple/);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect
      .poll(async () => (await rows.allTextContents()).every((text) => /Apple/i.test(text)))
      .toBe(true);
  });

  test('a system row opens the drawer read-only', async ({ page }) => {
    await page.getByPlaceholder('Search ingredients…').fill('Apple');
    await page.waitForURL(/q=Apple/);
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow.getByText('System', { exact: true })).toBeVisible();

    await firstRow.click();
    await expect(page.getByRole('heading', { name: 'Ingredient' })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save Ingredient' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    // Scoped to the sheet footer: the corner "x" close button also has the
    // accessible name "Close" (its sr-only label reuses common.close), so an
    // unscoped getByRole('button', { name: 'Close' }) matches both.
    await page.locator('[data-slot="sheet-footer"]').getByRole('button', { name: 'Close' }).click();
  });

  test('creating, editing, filtering by tag, and deleting a private ingredient', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const name = `QA E2E Ingredient ${uniqueSuffix}`;
    const tag = `qa-e2e-${uniqueSuffix}`;

    await page.getByRole('button', { name: '+ New Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Category').selectOption('Fruit');
    await page.getByLabel('Calories / 100g').fill('50');
    await page.getByLabel('Protein / 100g').fill('1');
    await page.getByLabel('Carbs / 100g').fill('12');
    await page.getByLabel('Fat / 100g').fill('0');
    await page.getByLabel('Unit').selectOption('piece');
    await page.getByLabel('Serving Size').fill('120');

    await page.getByLabel('Tags').fill(tag);
    await page.getByLabel('Tags').press('Enter');
    await expect(page.getByText(tag, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Save Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toHaveCount(0);

    // Filter down to the freshly-created row via the Tags pill.
    await page.getByRole('button', { name: 'Tags' }).click();
    await page.getByText(tag, { exact: true }).click();
    await page.waitForURL(/tags=/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('cell', { name })).toBeVisible();
    await expect(page.getByText('Mine', { exact: true })).toBeVisible();

    // Edit it.
    await page.getByRole('cell', { name }).click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toBeVisible();
    await page.getByLabel('Calories / 100g').fill('55');
    await page.getByRole('button', { name: 'Save Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toHaveCount(0);
    await expect(page.getByText('55 kcal / 100g')).toBeVisible();

    // Delete it, with confirmation.
    await page.getByRole('cell', { name }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Delete ingredient' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('cell', { name })).toHaveCount(0);
  });

  test('empty submit shows translated required errors, never the raw zod message', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    // Unit is deliberately not asserted here — it defaults to "Portion" on
    // create, so it's never blank on this path.
    await page.getByRole('button', { name: 'Save Ingredient' }).click();

    await expect(page.getByText('Name is required.')).toBeVisible();
    await expect(page.getByText('Category is required.')).toBeVisible();
    await expect(page.getByText('Calories is required.')).toBeVisible();
    await expect(page.getByText('Protein is required.')).toBeVisible();
    await expect(page.getByText('Carbs is required.')).toBeVisible();
    await expect(page.getByText('Fat is required.')).toBeVisible();
    await expect(page.getByText('Serving size is required.')).toBeVisible();

    // The zod schema's internal placeholder message is the bare string
    // "required" — before this fix it rendered verbatim for Calories, and
    // Protein/Carbs/Fat rendered no message at all. Assert it never
    // surfaces standalone (a translated sentence like "Calories is
    // required." legitimately contains the word, but never as the whole
    // text of an element).
    await expect(page.getByText('required', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('an inconsistent kcal value shows the KCAL_INCONSISTENT inline error on Calories, never a toast', async ({
    page,
  }) => {
    // Scoped to the drawer throughout: the KCAL_INCONSISTENT text used to
    // render twice (inline under Calories AND as a toast, since
    // useCreateFood/useUpdateFood's own onError toasted every error
    // including this one) — an unscoped getByText() would match both and
    // flake depending on whether the toast had already faded. Toast markup
    // lives in `[data-slot="toast-viewport"]`
    // (`@/components/ui/toast.tsx`), never inside the drawer's `dialog`.
    //
    // The "no toast" assertions below pass an explicit short timeout rather
    // than relying on Playwright's default (which happens to equal the
    // toast's own 5s auto-dismiss window, TOAST_DURATION_MS) — the check is
    // for an immediate negative, not "eventually disappears". Both the
    // inline setError() and the (now-skipped) toast call fire synchronously
    // in the same onError callback, so by the time the inline error is
    // visible, a toast — if the bug regressed — would already be mounted;
    // there is nothing to wait for.
    const drawer = page.getByRole('dialog');
    const toastViewport = page.locator('[data-slot="toast-viewport"]');
    const kcalInconsistentText = /doesn.t match macronutrients/i;
    const noToastTimeout = { timeout: 200 };

    // --- Create path ---
    await page.getByRole('button', { name: '+ New Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    const name = `QA Kcal Check ${Date.now()}`;
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Category').selectOption('Fruit');
    // 1g protein + 12g carbs + 0g fat = 52 kcal by the ±10% rule; 500 is far
    // outside that range, so CreateFoodEndpoint's KCAL_INCONSISTENT check
    // rejects it with a 400 — the drawer must surface that inline on the
    // Calories field rather than showing nothing (root cause: the NSwag
    // client throws the parsed body directly on 400, not an AxiosError, and
    // getErrorCode only read the AxiosError shape).
    await page.getByLabel('Calories / 100g').fill('500');
    await page.getByLabel('Protein / 100g').fill('1');
    await page.getByLabel('Carbs / 100g').fill('12');
    await page.getByLabel('Fat / 100g').fill('0');
    await page.getByLabel('Unit').selectOption('piece');
    await page.getByLabel('Serving Size').fill('120');

    await page.getByRole('button', { name: 'Save Ingredient' }).click();

    await expect(drawer.getByText(kcalInconsistentText)).toBeVisible();
    await expect(toastViewport.getByText(kcalInconsistentText)).toHaveCount(0, noToastTimeout);
    // The drawer stays open — the create request was rejected, not fulfilled.
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    // Fix the value and actually create it, so the edit path below has a
    // real, owned row to open.
    await page.getByLabel('Calories / 100g').fill('50');
    await page.getByRole('button', { name: 'Save Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toHaveCount(0);

    // --- Edit path ---
    const searchResponse = page.waitForResponse((response) => response.url().includes('/foods/search'));
    await page.getByPlaceholder('Search ingredients…').fill(name);
    await searchResponse;
    await page.waitForLoadState('networkidle');
    await page.getByRole('cell', { name }).click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toBeVisible();

    await page.getByLabel('Calories / 100g').fill('500');
    await page.getByRole('button', { name: 'Save Ingredient' }).click();

    await expect(drawer.getByText(kcalInconsistentText)).toBeVisible();
    await expect(toastViewport.getByText(kcalInconsistentText)).toHaveCount(0, noToastTimeout);
    // Still open — the update request was rejected too.
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toBeVisible();

    // Clean up: delete the row this test created.
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Delete ingredient' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('cell', { name })).toHaveCount(0);
  });

  test('cannot add a 21st tag', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toBeVisible();

    const tagsInput = page.getByLabel('Tags');
    for (let tagIndex = 1; tagIndex <= 20; tagIndex++) {
      await tagsInput.fill(`tag-${tagIndex}`);
      await tagsInput.press('Enter');
    }

    await expect(page.getByText('You can add up to 20 tags.')).toBeVisible();
    // TagsInput keeps its text input mounted but disables it once at the
    // cap — removing it entirely broke the "Tags" <Label>'s association
    // (#1115 code review) — so there's nowhere left to type a 21st tag, but
    // the labelled element itself still resolves.
    await expect(page.getByLabel('Tags')).toBeDisabled();
    // The max-tags message renders exactly once — not also duplicated by
    // IngredientDrawer's own zod-driven error text (#1115 code review).
    await expect(page.getByText('You can add up to 20 tags.')).toHaveCount(1);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('editing without changing Name preserves the base name for a food with per-language display names (rawName)', async ({
    page,
    baseURL,
  }) => {
    // Root cause fixed here: FoodSummary.Name (FoodSummary.cs) is resolved
    // for the request's Accept-Language, while FoodSummary.RawName always
    // mirrors the canonical stored name. valuesFromFood previously loaded
    // `food.name` into the form, so an untouched edit-save round-tripped the
    // TRANSLATED name back into UpdateFoodRequest.name, silently overwriting
    // the food's real base name. This food is created with nameEn distinct
    // from its base name specifically so the UI's `en` Accept-Language
    // resolves `.name` to something the fix must NOT load into the form.
    const origin = baseURL ?? 'http://localhost:5173';
    const uniqueSuffix = Date.now();
    const baseName = `qa-e2e-rawname-${uniqueSuffix}`;
    const nameEn = `${baseName} EN`;

    const createApi = await apiRequest.newContext({ baseURL: origin });
    let foodId: string;
    try {
      const accessToken = await loginAsNutritionist(origin);
      const createResponse = await createApi.post('/foods', {
        data: {
          name: baseName,
          nameEn,
          nameCs: `${baseName} CS`,
          nameDe: `${baseName} DE`,
          category: 'Fruit',
          nutrientValue: { kcal: 50, protein: 1, carbs: 12, fat: 0 },
          allergens: [],
          dietaryPreferences: [],
          tags: [],
          commonServings: [{ label: 'piece', weightGrams: 120 }],
        },
        headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Language': 'en' },
      });
      if (!createResponse.ok()) {
        throw new Error(
          `[ingredients] POST /foods (rawName fixture) returned ${createResponse.status()} ` +
            `${createResponse.statusText()}: ${await createResponse.text()}.`,
        );
      }
      const created = (await createResponse.json()) as FoodApiBody;
      if (!created.foodId) {
        throw new Error('[ingredients] POST /foods (rawName fixture) returned no foodId.');
      }
      foodId = created.foodId;
      expect(created.name).toBe(nameEn);
      expect(created.rawName).toBe(baseName);
    } finally {
      await createApi.dispose();
    }

    const searchResponse = page.waitForResponse((response) => response.url().includes('/foods/search'));
    await page.getByPlaceholder('Search ingredients…').fill(nameEn);
    await searchResponse;
    await page.waitForLoadState('networkidle');

    // The row shows the resolved (translated) name — the drawer's Name
    // field must load the CANONICAL name instead.
    await page.getByRole('cell', { name: nameEn }).click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue(baseName);

    await page.getByRole('button', { name: 'Save Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Ingredient' })).toHaveCount(0);

    const verifyApi = await apiRequest.newContext({ baseURL: origin });
    try {
      const accessToken = await loginAsNutritionist(origin);
      const getResponse = await verifyApi.get(`/foods/${foodId}`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Language': 'en' },
      });
      const body = (await getResponse.json()) as FoodApiBody;
      expect(body.rawName).toBe(baseName);

      await verifyApi.delete(`/foods/${foodId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    } finally {
      await verifyApi.dispose();
    }
  });
});
