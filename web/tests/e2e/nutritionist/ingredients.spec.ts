/**
 * #1115 — Ingredients page: list load, search, tag filter, create/edit/
 * delete a private ingredient, and a read-only system row. #1120 adds
 * coach-private food tags: create/edit/delete/filter/assign, and a
 * trainer-only coach seeing no tag UI at all.
 *
 * Path is deliberately under nutritionist/ — every project in
 * playwright.config.ts matches a role subfolder via testMatch, and
 * create/edit/delete on `/foods` (and all food-tag CRUD) are
 * Nutritionist-only (`Roles(AppRoles.Nutritionist)`) — the trainer fixture
 * can read the list but cannot exercise any write path. The trainer-only
 * "no tag UI" test below imports `trainerTest` directly rather than
 * living in its own `trainer/` file — Playwright's project routing is by
 * file path via `testMatch`, not by which fixture a test uses, so a single
 * test built on `trainerTest` inside this `nutritionist/` file still runs
 * (only) under the `nutritionist` project, same as every other test here.
 */
import { request as apiRequest } from '@playwright/test';
import { nutritionistTest as test, trainerTest, expect } from '../fixtures/auth';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const NUTRITIONIST_EMAIL = 'qa.nutri@fitnessplatform.test';

// This spec file lives at web/tests/e2e/nutritionist/ — four levels below the
// repo root, where docker-compose.test.yml and scripts/test-env's
// `.test-env.<project>.env` state files live (see `resolveMailhogPort` below).
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

interface LoginResponseBody {
  accessToken: string;
  refreshToken?: string;
}

interface FoodApiBody {
  foodId?: string;
  name?: string;
  rawName?: string;
  isSystem?: boolean;
}

interface FoodTagApiBody {
  tagId?: string;
  name?: string;
}

interface GetFoodTagsApiBody {
  tags?: FoodTagApiBody[];
}

interface SearchFoodsApiBody {
  foods?: FoodApiBody[];
}

interface MailhogHeaderMap {
  [header: string]: string[];
}

interface MailhogMessage {
  Content: {
    Headers: MailhogHeaderMap;
    Body: string;
  };
}

interface MailhogSearchResponse {
  items: MailhogMessage[];
}

/**
 * Resolves the ephemeral host port docker mapped for the harness's MailHog UI
 * (container port 8025 — see docker-compose.test.yml's `mailhog-test`
 * comment: a fixed port would collide between two branches' stacks). Reads
 * `COMPOSE_PROJECT_NAME` from whichever `.test-env.<project>.env` state file
 * `scripts/test-env up` wrote at the repo root, rather than re-deriving the
 * project name from the branch — that keeps this correct even if
 * `TEST_ENV_BRANCH` was set unusually for a given run.
 */
function resolveMailhogPort(): number {
  const stateFiles = readdirSync(REPO_ROOT).filter((name) => name.startsWith('.test-env.') && name.endsWith('.env'));
  if (stateFiles.length !== 1) {
    throw new Error(
      `[ingredients] Expected exactly one .test-env.*.env state file at the repo root to resolve the ` +
        `active compose project, found ${stateFiles.length}. Is the harness up (npm run e2e:up)?`,
    );
  }

  const stateFileContents = readFileSync(path.join(REPO_ROOT, stateFiles[0]), 'utf-8');
  const projectMatch = /^COMPOSE_PROJECT_NAME=(.+)$/m.exec(stateFileContents);
  if (!projectMatch) {
    throw new Error(`[ingredients] ${stateFiles[0]} carries no COMPOSE_PROJECT_NAME line.`);
  }

  const portMapping = execFileSync(
    'docker',
    ['compose', '-f', 'docker-compose.test.yml', 'port', 'mailhog-test', '8025'],
    { cwd: REPO_ROOT, env: { ...process.env, COMPOSE_PROJECT_NAME: projectMatch[1] } },
  )
    .toString()
    .trim();

  const port = Number(portMapping.split(':').pop());
  if (!Number.isFinite(port)) {
    throw new Error(
      `[ingredients] Could not parse a host port from 'docker compose port mailhog-test 8025' output: "${portMapping}".`,
    );
  }

  return port;
}

/** Case-insensitive lookup of a MailHog message header, e.g. Content-Transfer-Encoding. */
function findMailhogHeader(headers: MailhogHeaderMap, name: string): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key]?.[0] : undefined;
}

/**
 * Decodes a captured MailHog body per its own Content-Transfer-Encoding.
 * SmtpEmailService.cs's `SendEmailAsync` sends a single `TextPart("html")`
 * body (no multipart/alternative), so MailHog's top-level `Content.Body` is
 * the whole message — MimeKit quoted-printable-encodes the templated HTML
 * (long lines, and the verify link's own `token=` separator), so both forms
 * are handled defensively.
 */
function decodeMimeBody(rawBody: string, transferEncoding: string | undefined): string {
  const encoding = (transferEncoding ?? '').toLowerCase();
  if (encoding === 'quoted-printable') {
    return rawBody
      .replace(/=\r\n/g, '')
      .replace(/=\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  }
  if (encoding === 'base64') {
    return Buffer.from(rawBody.replace(/\r?\n/g, ''), 'base64').toString('utf-8');
  }
  return rawBody;
}

/**
 * Reads the newest MailHog message addressed to `toEmail` (the harness
 * captures outbound mail there instead of delivering it — #1059, project
 * memory `project_harness_email_mailhog`) and extracts the `?token=` query
 * value from the verification link (`SmtpEmailService.SendEmailVerificationAsync`
 * builds `{baseUrl}/verify-email?token={encodedToken}`).
 */
async function fetchVerificationTokenFromMailhog(toEmail: string): Promise<string> {
  const mailhogApi = await apiRequest.newContext({ baseURL: `http://localhost:${resolveMailhogPort()}` });
  try {
    const response = await mailhogApi.get('/api/v2/search', { params: { kind: 'to', query: toEmail } });
    if (!response.ok()) {
      throw new Error(`[ingredients] GET MailHog /api/v2/search returned ${response.status()} ${response.statusText()}.`);
    }
    const { items } = (await response.json()) as MailhogSearchResponse;
    if (items.length === 0) {
      throw new Error(`[ingredients] MailHog captured no message addressed to ${toEmail}.`);
    }

    // MailHog's search results are newest-first — items[0] is the verification email.
    const decodedBody = decodeMimeBody(
      items[0].Content.Body,
      findMailhogHeader(items[0].Content.Headers, 'Content-Transfer-Encoding'),
    );

    const tokenMatch = /verify-email\?token=([^"&\s]+)/.exec(decodedBody);
    if (!tokenMatch) {
      throw new Error(`[ingredients] Could not find a verify-email token link in the captured message to ${toEmail}.`);
    }

    return decodeURIComponent(tokenMatch[1]);
  } finally {
    await mailhogApi.dispose();
  }
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

/**
 * Deletes every food tag the caller owns via GET + DELETE
 * /trainer/food-tags, so each food-tags test starts and ends from zero
 * tags — CreateFoodTagEndpoint 409s on a duplicate name otherwise. Mirrors
 * `trainer/clients.spec.ts`'s `deleteAllClientTags`.
 */
async function deleteAllFoodTags(baseURL: string | undefined): Promise<void> {
  const resolvedBaseUrl = baseURL ?? 'http://localhost:5173';
  const accessToken = await loginAsNutritionist(resolvedBaseUrl);
  const api = await apiRequest.newContext({ baseURL: resolvedBaseUrl });
  try {
    const listResponse = await api.get('/trainer/food-tags', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listResponse.ok()) {
      throw new Error(`[ingredients] GET /trainer/food-tags returned ${listResponse.status()} ${listResponse.statusText()}.`);
    }
    const { tags } = (await listResponse.json()) as GetFoodTagsApiBody;
    for (const tag of tags ?? []) {
      if (!tag.tagId) {
        continue;
      }
      const deleteResponse = await api.delete(`/trainer/food-tags/${tag.tagId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(deleteResponse.ok()).toBe(true);
    }
  } finally {
    await api.dispose();
  }
}

/**
 * Finds a system food's id + name via GET /foods/search — used both to open
 * the read-only drawer for the "assign a tag to a food I don't own" AC, and
 * to assign a tag to it directly via PUT /trainer/foods/{FoodId}/tags. Prefers
 * "Apple" (the same seeded system food `a system row opens the drawer
 * read-only` already relies on).
 */
async function findSystemFood(baseURL: string | undefined): Promise<{ foodId: string; name: string }> {
  const resolvedBaseUrl = baseURL ?? 'http://localhost:5173';
  const accessToken = await loginAsNutritionist(resolvedBaseUrl);
  const api = await apiRequest.newContext({ baseURL: resolvedBaseUrl });
  try {
    const response = await api.get('/foods/search?q=Apple', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok()) {
      throw new Error(`[ingredients] GET /foods/search returned ${response.status()} ${response.statusText()}.`);
    }
    const { foods } = (await response.json()) as SearchFoodsApiBody;
    const systemFood = (foods ?? []).find((food) => food.isSystem && food.name && food.foodId);
    if (!systemFood?.name || !systemFood.foodId) {
      throw new Error('[ingredients] GET /foods/search?q=Apple returned no system food to tag.');
    }
    return { foodId: systemFood.foodId, name: systemFood.name };
  } finally {
    await api.dispose();
  }
}

/** Thin wrapper over `findSystemFood` for callers that only need the name. */
async function findSystemFoodName(baseURL: string | undefined): Promise<string> {
  return (await findSystemFood(baseURL)).name;
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

  test('search, filter pills, and the New Ingredient button share one row', async ({ page }) => {
    // #1115 — all four controls sit on a single flex row (IngredientsPage.tsx).
    // Compare vertical centers rather than raw `y`, since the search Input
    // (h-8) and the "+ New Ingredient" Button (size="lg", h-9) have different
    // heights but are vertically centered together by the row's `items-center`.
    const boxes = await Promise.all(
      [
        page.getByPlaceholder('Search ingredients…'),
        page.getByRole('button', { name: 'Category' }),
        page.getByRole('button', { name: 'Tags' }),
        page.getByRole('button', { name: '+ New Ingredient' }),
      ].map((locator) => locator.boundingBox()),
    );

    for (const box of boxes) {
      expect(box).not.toBeNull();
    }

    const verticalCenters = boxes.map((box) => box!.y + box!.height / 2);
    const spread = Math.max(...verticalCenters) - Math.min(...verticalCenters);
    expect(spread).toBeLessThan(10);
  });

  test('filtering by two categories returns only rows in those categories', async ({ page }) => {
    await page.getByRole('button', { name: 'Category' }).click();

    const filterResponse = page.waitForResponse(
      (response) => response.url().includes('/foods/search') && response.url().includes('category='),
    );
    await page.getByRole('checkbox', { name: 'Fruit' }).click();
    await page.getByRole('checkbox', { name: 'Dairy' }).click();
    await filterResponse;
    await page.waitForURL(/category=/);
    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    // Category is the 4th column (Name, Calories, Nutrients, Category, Library).
    const categoryCells = rows.locator('td:nth-child(4)');
    const categoryTexts = await categoryCells.allTextContents();
    expect(categoryTexts.length).toBeGreaterThan(0);
    for (const text of categoryTexts) {
      expect(['Fruit', 'Dairy']).toContain(text.trim());
    }
  });

  test("the table header's position doesn't move after scrolling the table body", async ({ page }) => {
    await page.locator('tbody tr').first().waitFor();

    const header = page.getByRole('columnheader', { name: 'Name' });
    const beforeBox = await header.boundingBox();
    expect(beforeBox).not.toBeNull();

    // The page's own vertical scroller -- see IngredientsPage.tsx's
    // `overflow-y-auto` wrapper -- not the window, since that's the ancestor
    // the sticky header actually sticks to.
    const scroller = page.locator('div.overflow-y-auto').filter({ has: page.locator('table') });
    const scrolledTop = await scroller.evaluate((element) => {
      element.scrollTop = 300;
      return element.scrollTop;
    });
    expect(scrolledTop).toBeGreaterThan(0);

    const afterBox = await header.boundingBox();
    expect(afterBox).not.toBeNull();
    expect(afterBox!.y).toBeCloseTo(beforeBox!.y, 0);
  });

  test('a clickable button reports cursor: pointer', async ({ page }) => {
    const cursor = await page
      .getByRole('button', { name: '+ New Ingredient' })
      .evaluate((element) => getComputedStyle(element).cursor);
    expect(cursor).toBe('pointer');
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

  test('creating, editing, and deleting a private ingredient', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const name = `QA E2E Ingredient ${uniqueSuffix}`;

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

    await page.getByRole('button', { name: 'Save Ingredient' }).click();
    await expect(page.getByRole('heading', { name: 'New Ingredient' })).toHaveCount(0);

    // Find the freshly-created row via search — tags are no longer a
    // free-text field on the ingredient itself (#1120); see the dedicated
    // "food tags" describe block below for tag create/filter/assign coverage.
    const searchResponse = page.waitForResponse((response) => response.url().includes('/foods/search'));
    await page.getByPlaceholder('Search ingredients…').fill(name);
    await searchResponse;
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

/**
 * Coach-private food tags (#1120): create from the filter popup, assign to
 * a food the caller does NOT own (a system food) through its read-only
 * drawer, and filter by the tag. Nutritionist-only, mirroring
 * `trainer/clients.spec.ts`'s "client tag filter — create a tag (#1119)"
 * describe block.
 */
test.describe('food tags (#1120)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await deleteAllFoodTags(baseURL);
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ baseURL }) => {
    await deleteAllFoodTags(baseURL);
  });

  test('creates a tag from the filter popup, assigns it to a system ingredient via the read-only drawer, and filters by it', async ({
    page,
    baseURL,
  }) => {
    const tagName = `QA Food Tag ${Date.now()}`;
    const popoverContent = page.locator("[data-slot='popover-content']");
    const dialog = page.locator("[data-slot='dialog-content']");

    // Create from the filter popover — reopens listed, unticked (mirrors
    // ClientTagFilterPopover / #1119's "+ Create tag" pattern).
    await page.getByRole('button', { name: 'Tags' }).click();
    await expect(popoverContent).toBeVisible();
    await expect(popoverContent.getByText('No tags yet.')).toBeVisible();

    await popoverContent.getByRole('button', { name: 'Create tag' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Create a new tag' })).toBeVisible();
    await dialog.getByLabel('Name').fill(tagName);

    const submitButton = dialog.getByRole('button', { name: 'Create tag', exact: true });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(dialog).toBeHidden();
    await expect(popoverContent).toBeVisible();
    const newTagRow = popoverContent.locator('li', { hasText: tagName });
    await expect(newTagRow).toBeVisible();
    await expect(newTagRow.getByRole('checkbox')).not.toBeChecked();
    await page.keyboard.press('Escape');

    // Open a SYSTEM food's read-only drawer and assign the new tag — a
    // nutritionist can tag any visible food, not just their own.
    const systemFoodName = await findSystemFoodName(baseURL);
    const searchResponse = page.waitForResponse((response) => response.url().includes('/foods/search'));
    await page.getByPlaceholder('Search ingredients…').fill(systemFoodName);
    await searchResponse;
    await page.waitForLoadState('networkidle');
    await page.getByRole('cell', { name: systemFoodName, exact: true }).first().click();
    // Scoped to the sheet content for the rest of this drawer-open span: the
    // table row behind the (non-modal) Sheet overlay stays in the DOM, and
    // once the tag is assigned below its own Tags-column chip renders the
    // same tagName text — an unscoped page.getByText(tagName) then resolves
    // two elements and throws a strict-mode violation.
    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(drawer.getByRole('heading', { name: 'Ingredient' })).toBeVisible();
    await expect(drawer.getByLabel('Name')).toBeDisabled();

    await expect(drawer.getByText('My Tags')).toBeVisible();
    await drawer.getByRole('button', { name: 'Assign tags' }).click();
    const drawerPopover = page.locator("[data-slot='popover-content']");
    await expect(drawerPopover).toBeVisible();
    const assignResponse = page.waitForResponse(
      (response) => response.url().includes('/tags') && response.request().method() === 'PUT',
    );
    await drawerPopover.locator('li', { hasText: tagName }).getByRole('checkbox').click();
    await assignResponse;
    await page.keyboard.press('Escape');

    // The tag chip now renders in the drawer — scoped to `drawer`, since the
    // list row underneath (now also showing this tag's chip in its Tags
    // column) still matches the same text (see the comment above).
    await expect(drawer.getByText(tagName, { exact: true })).toBeVisible();

    // Scoped to the sheet footer, same reasoning as the read-only test
    // above: the corner "x" close button shares the accessible name "Close".
    await drawer.locator('[data-slot="sheet-footer"]').getByRole('button', { name: 'Close' }).click();

    // Filter the list by the tag — the system food now matches.
    await page.getByRole('button', { name: 'Tags' }).click();
    await expect(popoverContent).toBeVisible();
    const filterResponse = page.waitForResponse(
      (response) => response.url().includes('/foods/search') && response.url().includes('tagIds='),
    );
    await popoverContent.locator('li', { hasText: tagName }).getByRole('checkbox').click();
    await filterResponse;
    await page.waitForURL(/tags=/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('cell', { name: systemFoodName, exact: true })).toBeVisible();
    await expect(page.getByText('System', { exact: true })).toBeVisible();
  });

  test("a second nutritionist can't see qa.nutri's food tag (#1120)", async ({ baseURL, browser }) => {
    // QA finding: the only prior "a second coach doesn't see it" coverage used
    // a trainer, and a trainer can never own a food tag (Roles(AppRoles.Nutritionist)
    // on every food-tags endpoint — CreateFoodTagEndpoint.cs, GetFoodTagsEndpoint.cs),
    // so it never proved cross-NUTRITIONIST isolation. The seed has only one
    // nutritionist (qa.nutri), so the second nutritionist here is a throwaway
    // account registered fresh through the real API rather than a fixture.
    const origin = baseURL ?? 'http://localhost:5173';
    const tagName = `QA Nutri Isolation Tag ${Date.now()}`;

    // --- qa.nutri: create a tag and assign it to a system food, both via the API. ---
    const ownerAccessToken = await loginAsNutritionist(origin);
    const ownerApi = await apiRequest.newContext({ baseURL: origin });
    let systemFood: { foodId: string; name: string };
    try {
      const createResponse = await ownerApi.post('/trainer/food-tags', {
        data: { name: tagName, colorHex: '#3b82f6' },
        headers: { Authorization: `Bearer ${ownerAccessToken}` },
      });
      if (!createResponse.ok()) {
        throw new Error(`[ingredients] POST /trainer/food-tags returned ${createResponse.status()} ${createResponse.statusText()}.`);
      }
      const createdTag = (await createResponse.json()) as FoodTagApiBody;
      if (!createdTag.tagId) {
        throw new Error('[ingredients] POST /trainer/food-tags returned no tagId.');
      }

      systemFood = await findSystemFood(origin);

      const assignResponse = await ownerApi.put(`/trainer/foods/${systemFood.foodId}/tags`, {
        data: { tagIds: [createdTag.tagId] },
        headers: { Authorization: `Bearer ${ownerAccessToken}` },
      });
      if (!assignResponse.ok()) {
        throw new Error(
          `[ingredients] PUT /trainer/foods/{FoodId}/tags returned ${assignResponse.status()} ${assignResponse.statusText()}.`,
        );
      }
    } finally {
      await ownerApi.dispose();
    }

    // --- A throwaway second nutritionist, registered fresh through the real API.
    // LoginEndpoint.cs itself never gates on EmailConfirmed — but the web portal
    // does, client-side: ProtectedRoute.tsx redirects to /verify-email whenever
    // `user.emailConfirmed` is false, so B needs a real verification round trip
    // (via MailHog) before /ingredients renders anything for B to assert on. ---
    const secondNutriEmail = `qa.nutri.isolation.${Date.now()}@fitnessplatform.test`;
    const secondNutriPassword = 'CorrectHorse9';

    const registerApi = await apiRequest.newContext({ baseURL: origin });
    try {
      const registerResponse = await registerApi.post('/auth/register', {
        data: {
          email: secondNutriEmail,
          password: secondNutriPassword,
          confirmPassword: secondNutriPassword,
          firstName: 'QA',
          lastName: 'SecondNutri',
          roles: ['Nutritionist'],
          gdprConsent: true,
        },
      });
      if (!registerResponse.ok()) {
        throw new Error(
          `[ingredients] POST /auth/register (second nutritionist) returned ${registerResponse.status()} ` +
            `${registerResponse.statusText()}: ${await registerResponse.text()}.`,
        );
      }
    } finally {
      await registerApi.dispose();
    }

    const verificationToken = await fetchVerificationTokenFromMailhog(secondNutriEmail);
    const verifyApi = await apiRequest.newContext({ baseURL: origin });
    try {
      const verifyResponse = await verifyApi.post('/auth/verify-email', { data: { token: verificationToken } });
      if (!verifyResponse.ok()) {
        throw new Error(
          `[ingredients] POST /auth/verify-email (second nutritionist) returned ${verifyResponse.status()} ${verifyResponse.statusText()}.`,
        );
      }
    } finally {
      await verifyApi.dispose();
    }

    const secondLoginApi = await apiRequest.newContext({ baseURL: origin });
    let secondNutriAccessToken: string;
    let secondNutriRefreshToken: string;
    try {
      const loginResponse = await secondLoginApi.post('/auth/login', {
        data: { email: secondNutriEmail, password: secondNutriPassword },
      });
      if (!loginResponse.ok()) {
        throw new Error(
          `[ingredients] POST /auth/login (second nutritionist) returned ${loginResponse.status()} ${loginResponse.statusText()}.`,
        );
      }
      const loginBody = (await loginResponse.json()) as LoginResponseBody;
      if (!loginBody.refreshToken) {
        throw new Error('[ingredients] POST /auth/login (second nutritionist) returned no refreshToken.');
      }
      secondNutriAccessToken = loginBody.accessToken;
      secondNutriRefreshToken = loginBody.refreshToken;
    } finally {
      await secondLoginApi.dispose();
    }

    // A fresh browser context, authenticated as B — never A's shared `page`/storage
    // state. Mirrors the storage-state shape auth.setup.ts writes (`refreshToken` +
    // `lang` under the app's own origin), same as `fixtures/auth.ts`'s `openClientContext`.
    const secondNutriContext = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [
              { name: 'refreshToken', value: secondNutriRefreshToken },
              { name: 'lang', value: 'en' },
            ],
          },
        ],
      },
    });

    try {
      const secondNutriPage = await secondNutriContext.newPage();
      await secondNutriPage.goto('/ingredients');
      await secondNutriPage.waitForLoadState('networkidle');
      await expect(secondNutriPage.getByRole('heading', { name: 'Ingredients' })).toBeVisible();

      // The tag filter popover lists no tag with A's name.
      await secondNutriPage.getByRole('button', { name: 'Tags' }).click();
      const secondNutriPopover = secondNutriPage.locator("[data-slot='popover-content']");
      await expect(secondNutriPopover).toBeVisible();
      await expect(secondNutriPopover.locator('li', { hasText: tagName })).toHaveCount(0);
      await secondNutriPage.keyboard.press('Escape');

      // The system food's row shows no chip with A's tag name.
      const searchResponse = secondNutriPage.waitForResponse((response) => response.url().includes('/foods/search'));
      await secondNutriPage.getByPlaceholder('Search ingredients…').fill(systemFood.name);
      await searchResponse;
      await secondNutriPage.waitForLoadState('networkidle');
      const systemFoodRow = secondNutriPage
        .locator('tbody tr')
        .filter({ has: secondNutriPage.getByRole('cell', { name: systemFood.name, exact: true }) });
      await expect(systemFoodRow.getByText(tagName, { exact: true })).toHaveCount(0);

      // Opening that food's (read-only) drawer shows no chip with A's tag name.
      // Scoped to the drawer, not the page — the list row behind the (non-modal)
      // Sheet overlay stays in the DOM and would otherwise double-match.
      await secondNutriPage.getByRole('cell', { name: systemFood.name, exact: true }).first().click();
      const secondNutriDrawer = secondNutriPage.locator('[data-slot="sheet-content"]');
      await expect(secondNutriDrawer.getByRole('heading', { name: 'Ingredient' })).toBeVisible();
      await expect(secondNutriDrawer.getByText(tagName, { exact: true })).toHaveCount(0);
      await secondNutriDrawer.locator('[data-slot="sheet-footer"]').getByRole('button', { name: 'Close' }).click();
    } finally {
      await secondNutriContext.close();
    }

    // Also assert via B's own API that GET /trainer/food-tags never contains A's tag.
    const secondNutriTagsApi = await apiRequest.newContext({ baseURL: origin });
    try {
      const tagsResponse = await secondNutriTagsApi.get('/trainer/food-tags', {
        headers: { Authorization: `Bearer ${secondNutriAccessToken}` },
      });
      if (!tagsResponse.ok()) {
        throw new Error(
          `[ingredients] GET /trainer/food-tags (second nutritionist) returned ${tagsResponse.status()} ${tagsResponse.statusText()}.`,
        );
      }
      const { tags } = (await tagsResponse.json()) as GetFoodTagsApiBody;
      expect((tags ?? []).some((tag) => tag.name === tagName)).toBe(false);
    } finally {
      await secondNutriTagsApi.dispose();
    }

    // A's tag itself is cleaned up by this describe block's shared afterEach
    // (deleteAllFoodTags), which already asserts every DELETE response.ok().
  });
});

/**
 * A trainer-only coach has no food tags of their own (only a nutritionist
 * can create one) — the Ingredients page must show no tag UI at all for
 * them: no filter pill, and no tag section in the drawer. Uses `trainerTest`
 * directly (see this file's header comment on why that still runs under the
 * `nutritionist` Playwright project).
 */
trainerTest.describe('food tags — trainer-only coach (#1120)', () => {
  trainerTest('sees no food tag UI on the Ingredients page', async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();

    // No Tags filter pill at all.
    await expect(page.getByRole('button', { name: 'Tags' })).toHaveCount(0);

    // Opening any row's (read-only) drawer shows no tag section either.
    await page.locator('tbody tr').first().click();
    await expect(page.getByRole('heading', { name: 'Ingredient' })).toBeVisible();
    await expect(page.getByText('My Tags')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Assign tags' })).toHaveCount(0);
  });
});
