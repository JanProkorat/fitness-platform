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
 * seeded with NutritionistId = NutriUserId (33333333-...). UploadRecipeImageUrlEndpoint
 * compares recipe.NutritionistId against AppClaims.UserId (the ApplicationUser.Id,
 * what CreateRecipeEndpoint writes) — NOT the profile PublicId — so the logged-in
 * nutritionist (qa.nutri@fitnessplatform.test) passes the ownership check.
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
  // RecipeDialog fetches the full recipe (GET /recipes/:id) after open and
  // opens in VIEW mode (setMode('view') in the useEffect for existing recipes).
  // In view mode the footer renders an "Edit Recipe" button
  // (t('recipes.editRecipe') = "Edit Recipe" / "Upravit recept" / "Rezept bearbeiten").
  // Waiting for that button confirms the dialog is fully mounted AND the detail
  // request has completed (the footer is only rendered when !loading).
  const editRecipeButton = page.getByRole('button', {
    name: /Edit Recipe|Upravit recept|Rezept bearbeiten/i,
  });
  await expect(editRecipeButton).toBeVisible({ timeout: 20_000 });

  // ── 3b. Switch to edit mode ───────────────────────────────────────────────────
  // RecipeImageSection is only mounted inside the `{mode === 'edit' && …}` block
  // of RecipeDialog. Clicking the Edit Recipe button calls switchMode('edit'),
  // which applies a 150ms CSS transition before setting mode state. After the
  // click we wait for the image section gallery heading as an edit-mode sentinel.
  await editRecipeButton.click();
  // switchMode has a 150ms delay + 20ms debounce — wait for the gallery heading
  // (t('recipes.image.galleryHeading')) which is rendered by RecipeImageSection.
  await expect(
    page.getByText(/Galerie|Gallery|Galerie der Bilder/i),
  ).toBeVisible({ timeout: 5_000 });

  // ── 4. Locate the gallery SlotPicker input and set the file ──────────────────
  // RecipeImageSection renders the gallery slot picker as:
  //   <input type="file" data-testid="recipe-gallery-image-input" class="sr-only" />
  //
  // The data-testid targets the gallery slot directly, regardless of whether the
  // main image slot is also visible, making the locator position-independent.
  const galleryInput = page.locator('[data-testid="recipe-gallery-image-input"]');
  await galleryInput.waitFor({ state: 'attached', timeout: 10_000 });

  // ── 5. Register the confirm-response waiter BEFORE triggering the upload ──────
  // The upload chain runs synchronously inside setInputFiles' round-trip: the
  // upload-url request fires, then the MinIO PUT, then the confirm PUT, all before
  // setInputFiles resolves. Registering waitForResponse after setInputFiles would
  // race and miss the response.
  //
  // The confirm call is: PUT /recipes/:id/image  (no "/confirm" segment)
  // See web/src/api/recipes.ts → confirmRecipeImage: api.put(`/recipes/${recipeId}/image`, …)
  const confirmResponsePromise = page.waitForResponse(
    (resp) =>
      resp.request().method() === 'PUT' &&
      /\/recipes\/[^/]+\/image(\?|$)/.test(resp.url()) &&
      (resp.status() === 200 || resp.status() === 204),
    { timeout: 30_000 },
  );

  // RecipeImageSection → uploadImage():
  //   1. POST /recipes/:id/image/upload-url  (handleGalleryFile)
  //   2. PUT  <signed URL>                   (direct PUT to MinIO)
  //   3. PUT  /recipes/:id/image             (confirm — persists the blob URL)
  await galleryInput.setInputFiles({
    name: 'recipe-gallery.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });

  await confirmResponsePromise;

  // ── 6. Assert the new gallery thumbnail renders ───────────────────────────────
  // After confirmRecipeImage(), RecipeImageSection calls onUploaded('gallery')
  // which triggers the parent RecipeDialog to reload the recipe via getRecipe().
  // The updated detail.galleryImageUrls array now contains the new blob URL.
  // RecipeImageSection renders each gallery URL as a <Thumbnail> with an <img
  //   data-testid="recipe-gallery-thumbnail-0">.
  const galleryThumbnail = page.locator('[data-testid="recipe-gallery-thumbnail-0"]');
  await expect(galleryThumbnail).toBeVisible({ timeout: 15_000 });
});
