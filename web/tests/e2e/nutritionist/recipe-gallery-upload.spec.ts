/**
 * Durable spec — nutritionist uploads a recipe gallery image (issue #120, Phase 4).
 *
 * This spec verifies the recipe gallery image upload flow in the trainer web portal:
 *   1. Navigate to /recipes.
 *   2. Wait for the seeded recipe to appear in the table.
 *   3. Click the row to open RecipeDialog.
 *   4. Locate the RecipeImageSection gallery slot picker button inside the dialog
 *      and set a file on its hidden input.
 *   5. Wait for the upload flow to complete:
 *        POST /recipes/:id/image/upload-url  → returns { uploadUrl, blobUrl }
 *        PUT  <minio pre-signed URL>         → 200
 *        POST /recipes/:id/image/confirm     → 200
 *   6. Assert the newly uploaded gallery thumbnail renders inside the dialog.
 *
 * Recipe ownership: QaRecipe1ExternalId ("Chicken + Rice + Broccoli bowl") is
 * seeded with AuthorId = NutriProfilePublicId (cccccccc-...), so the logged-in
 * nutritionist (qa.nutri@fitnessplatform.test) passes the isOwner check in
 * RecipeImageSection.
 *
 * WHY ONE CONSOLIDATED TEST:
 * storageState restores a refresh token from disk. Multiple test() blocks would
 * each try to restore the same stale token and 401. One test = one token rotation.
 *
 * Seed dependency: Phase 3 must be committed and QaSeedRunnerTests green
 * before this spec runs. The seed creates 3 recipes owned by the QA nutritionist:
 *   QaRecipe1 — "Chicken + Rice + Broccoli bowl"
 *   QaRecipe2 — "Oats + Banana breakfast"
 *   QaRecipe3 — "Chicken + Broccoli stir-fry"
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

test('recipe-gallery-upload — nutritionist uploads recipe gallery image and it appears', async ({
  page,
}) => {
  // ── 1. Navigate to /recipes ──────────────────────────────────────────────────
  await page.goto('/recipes');

  // Wait for restoreSession() (POST /auth/refresh) to complete and the recipe
  // list to load from the compose harness.
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // ── 2. Wait for seeded recipe to appear ─────────────────────────────────────
  // The seed adds QaRecipe1 named "Chicken + Rice + Broccoli bowl".
  // Default sort is by name ascending; it will appear near the top.
  const recipeRow = page
    .getByRole('table')
    .getByText('Chicken', { exact: false });
  await expect(recipeRow.first()).toBeVisible({ timeout: 30_000 });

  // ── 3. Click the row to open RecipeDialog ────────────────────────────────────
  // RecipesPage → DatabaseTable: onRowClick={(r) => recipeDialog.openEdit(r)}
  await recipeRow.first().click();

  // Wait for the RecipeDialog to open and the detail to load.
  // RecipeDialog fetches the full recipe (GET /recipes/:id) after open.
  // Wait for network to settle so the dialog is fully populated.
  await page.waitForLoadState('networkidle', { timeout: 20_000 });

  // The RecipeImageSection renders a gallery section with a heading.
  // Wait for any image section heading text to confirm the dialog rendered.
  const dialogOpened = page.getByText(/Galerie|Gallery|Galerie der Bilder/i);
  await expect(dialogOpened.first()).toBeVisible({ timeout: 15_000 });

  // ── 4. Locate the gallery SlotPicker input and set the file ──────────────────
  // RecipeImageSection renders the gallery slot as:
  //   <input type="file" class="sr-only" accept="image/jpeg,..." />
  //   <button type="button" ...>  (the 72×72 dashed-border slot)
  //
  // When isOwner=true, the gallery slot picker is always visible (even when
  // galleryFull is false — up to 6 images). We set files directly on the
  // hidden input attached to the gallery slot.
  //
  // The gallery slot input is the second sr-only file input (main image slot
  // renders the first one). If the recipe already has a main image the slot
  // layout changes — but since the seeded recipe has no image yet, both main
  // and gallery inputs are present in the DOM.
  //
  // Use a file input locator that targets the gallery area. The gallery slot
  // picker button has a title attribute set to t('recipes.image.addPhoto')
  // when gallery is not full — but we target the input directly for robustness.
  const fileInputs = page.locator('input[type="file"][accept*="image"]');
  // The gallery slot is the second file input when both main and gallery are visible,
  // or the first if only the gallery is shown (main image already exists via seed blob key).
  // Target the last available input to prefer the gallery slot.
  const galleryInput = fileInputs.last();
  await galleryInput.waitFor({ state: 'attached', timeout: 10_000 });
  await galleryInput.setInputFiles({
    name: 'recipe-gallery.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });

  // ── 5. Wait for the upload flow to complete ───────────────────────────────────
  // RecipeImageSection → uploadImage():
  //   1. POST /recipes/:id/image/upload-url  (handleGalleryFile)
  //   2. PUT  <signed URL>                   (direct PUT to MinIO)
  //   3. POST /recipes/:id/image/confirm
  // Wait for the confirm endpoint to return 200.
  await page.waitForResponse(
    (resp) => resp.url().includes('/image/confirm') && resp.status() === 200,
    { timeout: 30_000 },
  );

  // ── 6. Assert the new gallery thumbnail renders ───────────────────────────────
  // After confirmRecipeImage(), RecipeImageSection calls onUploaded('gallery')
  // which triggers the parent RecipeDialog to reload the recipe via getRecipe().
  // The updated detail.galleryImageUrls array now contains the new blob URL.
  // RecipeImageSection renders each gallery URL as a <Thumbnail> with an <img>.
  //
  // Wait for an img element inside the dialog area whose src includes the
  // MinIO blob path (or any img that wasn't there before upload).
  const galleryThumbnail = page.locator('img[src*="recipes/"]').or(
    page.locator('img[alt*="Gallery photo"]'),
  );
  await expect(galleryThumbnail.first()).toBeVisible({ timeout: 15_000 });
});
