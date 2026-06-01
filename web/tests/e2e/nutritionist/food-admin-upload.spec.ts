/**
 * Durable spec — nutritionist uploads a food image (issue #120, Phase 4).
 *
 * This spec verifies the food image upload flow in the trainer web portal:
 *   1. Navigate to /foods.
 *   2. Wait for the seeded food "Chicken Breast" to appear in the table.
 *   3. Click the row to open FoodDialog.
 *   4. Locate the FoodImageSection "main image" slot picker button (the
 *      dashed-border + slot) inside the dialog and set a file on its hidden input.
 *   5. Wait for the upload flow to complete:
 *        POST /foods/:id/image/upload-url  → returns { uploadUrl, blobUrl }
 *        PUT  <minio pre-signed URL>       → 200
 *        POST /foods/:id/image/confirm     → 200
 *   6. Assert the newly uploaded image <img> renders inside the dialog.
 *
 * Food ownership: QaFood1ExternalId (Chicken Breast) is seeded with
 * NutritionistId = NutriUserId (33333333-...). UploadFoodImageUrlEndpoint
 * compares food.NutritionistId against AppClaims.UserId (the ApplicationUser.Id,
 * what CreateFoodEndpoint writes) — NOT the profile PublicId — so the logged-in
 * nutritionist (qa.nutri@fitnessplatform.test) passes the ownership check.
 *
 * WHY ONE CONSOLIDATED TEST:
 * storageState restores a refresh token from disk. Multiple test() blocks would
 * each try to restore the same stale token and 401. One test = one token rotation.
 *
 * Seed dependency: Phase 3 must be committed and QaSeedRunnerTests green
 * before this spec runs. The seed creates 5 foods (Chicken Breast, White Rice,
 * Broccoli, Banana, Rolled Oats) owned by the QA nutritionist.
 */

import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

// ── Minimal 1×1 transparent PNG (67 bytes) ────────────────────────────────────
// Inline buffer so no binary fixture file is committed to the repo.
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806' +
    '0000001f15c4890000000a49444154789c6260000000000200' +
    '0173e016170000000049454e44ae426082',
  'hex',
);

test('food-admin-upload — nutritionist uploads food image and it renders in dialog', async ({
  page,
}) => {
  // ── 1. Navigate to /foods ────────────────────────────────────────────────────
  await page.goto('/foods');

  // Wait for restoreSession() (POST /auth/refresh) to complete and the food
  // list to load from the compose harness.
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // ── 2. Wait for seeded "Chicken Breast" food to appear ───────────────────────
  // The seed adds QaFood1 with name "Chicken Breast" owned by the QA nutritionist.
  // The default sort is by name ascending, so Chicken Breast should appear near
  // the top of the table.
  const chickenRow = page.getByRole('table').getByText('Chicken Breast', { exact: false });
  await expect(chickenRow.first()).toBeVisible({ timeout: 30_000 });

  // ── 3. Click the row to open FoodDialog ──────────────────────────────────────
  // FoodsPage → DatabaseTable: onRowClick={(food) => foodDialog.openEdit(food)}
  // (only wired when isNutritionist is true, which it is for qa.nutri).
  await chickenRow.first().click();

  // Wait for the dialog to open in VIEW mode. FoodDialog sets mode='view' in
  // the useEffect that fires when open=true and the food prop is not null.
  // In view mode the footer renders an "Edit food" button
  // (t('foods.editFoodTitle') = "Edit food" / "Upravit potravinu" / "Lebensmittel bearbeiten").
  // Waiting for that button confirms the dialog is fully mounted.
  const editFoodButton = page.getByRole('button', {
    name: /Edit food|Upravit potravinu|Lebensmittel bearbeiten/i,
  });
  await expect(editFoodButton).toBeVisible({ timeout: 15_000 });

  // ── 3b. Switch to edit mode ───────────────────────────────────────────────────
  // FoodImageSection is only mounted inside the `{mode === 'edit' && …}` branch
  // of FoodDialog. Clicking the Edit button calls switchMode('edit'), which
  // applies a 150ms CSS transition before setting mode state. After the click
  // we wait for the section heading to confirm the edit panel is in the DOM.
  await editFoodButton.click();
  // switchMode has a 150ms delay + 20ms debounce before re-rendering — wait for
  // the image section heading as a reliable edit-mode sentinel.
  await expect(
    page.getByText(/Hlavní fotka|Main image|Hauptbild/i),
  ).toBeVisible({ timeout: 5_000 });

  // ── 4. Locate the SlotPicker input and set the file ──────────────────────────
  // FoodImageSection / SlotPicker renders a hidden <input type="file"> with
  // data-testid="food-main-image-input" when no main image exists yet (isOwner=true).
  // Playwright can set files on sr-only inputs directly even though they are
  // visually hidden.
  const fileInput = page.locator('[data-testid="food-main-image-input"]');
  await fileInput.waitFor({ state: 'attached', timeout: 10_000 });

  // ── 5. Register the confirm-response waiter BEFORE triggering the upload ──────
  // The upload chain runs synchronously inside setInputFiles' round-trip: the
  // upload-url request fires, then the MinIO PUT, then the confirm PUT, all before
  // setInputFiles resolves. Registering waitForResponse after setInputFiles would
  // race and miss the response.
  //
  // The confirm call is: PUT /foods/:id/image  (no "/confirm" segment)
  // See web/src/api/foods.ts → confirmFoodImage: api.put(`/foods/${foodId}/image`, …)
  const confirmResponsePromise = page.waitForResponse(
    (resp) =>
      resp.request().method() === 'PUT' &&
      /\/foods\/[^/]+\/image(\?|$)/.test(resp.url()) &&
      (resp.status() === 200 || resp.status() === 204),
    { timeout: 30_000 },
  );

  // FoodImageSection → uploadImage():
  //   1. POST /foods/:id/image/upload-url  (SlotPicker triggers handleMainFile)
  //   2. PUT  <signed URL>                 (direct PUT to MinIO)
  //   3. PUT  /foods/:id/image             (confirm — persists the blob URL)
  await fileInput.setInputFiles({
    name: 'food.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });

  await confirmResponsePromise;

  // ── 6. Assert the uploaded image renders in the dialog ───────────────────────
  // After a successful confirmFoodImage(), the FoodDialog calls onUploaded()
  // which sets committedImageUrl via setCommittedImageUrl. The FoodImageSection
  // then renders the <img data-testid="food-main-image"> for the main slot.
  const uploadedImg = page.locator('[data-testid="food-main-image"]');
  await expect(uploadedImg).toBeVisible({ timeout: 15_000 });
});
