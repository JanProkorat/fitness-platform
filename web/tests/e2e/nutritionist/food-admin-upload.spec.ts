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
 * AuthorId = NutriProfilePublicId (cccccccc-...), so the logged-in nutritionist
 * (qa.nutri@fitnessplatform.test) passes the isOwner check in FoodImageSection.
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

  // Wait for the dialog to open. FoodDialog renders inside a `role="dialog"`
  // shadcn container; target that explicitly so we don't accidentally match a
  // random aria-hidden element on the page (e.g. a modal backdrop, a hidden
  // tooltip). The image-section heading is included as a secondary check
  // because it lives inside the dialog body — the .or() resolves to whichever
  // is found first, but in practice both co-occur so the second clause is a
  // safety net for shadcn version drift, NOT a fallback for "dialog wasn't
  // wired" (the heading-outside-dialog case is not supported by this spec).
  const dialog = page.getByRole('dialog').or(
    page.getByText(/Hlavní fotka|Main image|Hauptbild/i),
  );
  await expect(dialog.first()).toBeVisible({ timeout: 15_000 });

  // ── 4. Locate the SlotPicker input and set the file ──────────────────────────
  // FoodImageSection / SlotPicker renders a hidden <input type="file"> with
  // data-testid="food-main-image-input" when no main image exists yet (isOwner=true).
  // Playwright can set files on sr-only inputs directly even though they are
  // visually hidden.
  const fileInput = page.locator('[data-testid="food-main-image-input"]');
  await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
  await fileInput.setInputFiles({
    name: 'food.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });

  // ── 5. Wait for the upload flow to complete ───────────────────────────────────
  // FoodImageSection → uploadImage():
  //   1. POST /foods/:id/image/upload-url  (SlotPicker triggers handleMainFile)
  //   2. PUT  <signed URL>                 (direct PUT to MinIO)
  //   3. POST /foods/:id/image/confirm
  // Wait for the confirm endpoint to return a 200.
  await page.waitForResponse(
    (resp) => resp.url().includes('/image/confirm') && resp.status() === 200,
    { timeout: 30_000 },
  );

  // ── 6. Assert the uploaded image renders in the dialog ───────────────────────
  // After a successful confirmFoodImage(), the FoodDialog calls onUploaded()
  // which sets committedImageUrl via setCommittedImageUrl. The FoodImageSection
  // then renders the <img data-testid="food-main-image"> for the main slot.
  const uploadedImg = page.locator('[data-testid="food-main-image"]');
  await expect(uploadedImg).toBeVisible({ timeout: 15_000 });
});
