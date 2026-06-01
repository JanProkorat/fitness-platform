/**
 * Durable spec — client uploads a profile avatar (issue #120, Phase 4).
 *
 * This spec targets the mobile-web bundle served by Expo's web renderer.
 * The baseURL is overridden to MOBILE_WEB_BASE_URL (default http://localhost:8081;
 * set to http://mobile-web:8081 inside the qa-playwright container via the
 * MOBILE_WEB_BASE_URL env var — the orchestrator sets this in Phase 5).
 *
 * The spec verifies the full upload journey:
 *   1. Navigate to /profile (mobile-web tab route).
 *   2. Wait for the page to stabilise after auth restore.
 *   3. Trigger the file picker on the Avatar camera badge.
 *      On react-native-web, expo-image-picker.launchImageLibraryAsync creates a
 *      hidden <input type="file"> and immediately shows the native file dialog.
 *      Playwright intercepts this by attaching to the filechooser event, then
 *      calling setFiles() on the input.
 *   4. Wait for the PUT upload to complete (MinIO pre-signed URL) and the
 *      POST /users/avatar/confirm API call to return 200.
 *   5. Assert the <img> with the new blob URL becomes visible in the DOM.
 *   6. Reload and assert the avatar persists (the auth store re-fetches the
 *      user profile on mount, which returns the updated avatarBlobUrl).
 *
 * WHY ONE CONSOLIDATED TEST:
 * storageState restores a refresh token from disk. On the first page.goto(),
 * the app calls restoreSession() (POST /auth/refresh), which rotates the
 * token — the on-disk token is now stale. Multiple test() blocks would each
 * try to restore the same stale token and 401 → redirect to login. One
 * test = one rotation.
 *
 * Seed dependency: Phase 3 must be committed and QaSeedRunnerTests green
 * before this spec runs. The seed creates qa.client@fitnessplatform.test with
 * ClientUserId = 11111111-... and an initial avatarBlobKey = QaAvatarBlobKey.
 */

import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

// ── Base URL override ──────────────────────────────────────────────────────────
// Inside the qa-playwright container, MOBILE_WEB_BASE_URL is set to
// http://mobile-web:8081 by the orchestrator in Phase 5.
const MOBILE_WEB_BASE_URL = process.env['MOBILE_WEB_BASE_URL'] ?? 'http://localhost:8081';

test.use({ baseURL: MOBILE_WEB_BASE_URL });

// ── Minimal 1×1 transparent PNG (67 bytes) ────────────────────────────────────
// Inline buffer so no binary fixture file is committed to the repo.
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806' +
    '0000001f15c4890000000a49444154789c6260000000000200' +
    '0173e016170000000049454e44ae426082',
  'hex',
);

test('user-avatar-upload — client uploads avatar and it persists across reload', async ({
  page,
}) => {
  // ── 1. Navigate to the profile tab ──────────────────────────────────────────
  // Expo Router file-based routes: app/(client)/(tabs)/profile.tsx → /profile
  // The mobile-web bundle mounts at the root, so the profile tab is at /profile.
  await page.goto('/profile');

  // Wait for restoreSession() (POST /auth/refresh) to complete and the page to
  // render the profile content. networkidle ensures the auth token rotation
  // finishes before we interact.
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // ── 2. Find the camera badge on the Avatar component ─────────────────────────
  // Avatar renders with accessibilityLabel={t('avatar.editBadgeLabel')} on the
  // camera Pressable. On react-native-web, Pressable compiles to a div/button.
  // We locate it by its accessible label — the i18n values are:
  //   cs: "Změnit profilovou fotku"
  //   en: "Change profile photo"
  //   de: "Profilbild ändern"
  const cameraBadge = page.getByRole('button', {
    name: /Změnit profilovou fotku|Change profile photo|Profilbild ändern/i,
  });
  await expect(cameraBadge).toBeVisible({ timeout: 15_000 });

  // ── 3. Intercept the file chooser and supply the tiny PNG ─────────────────────
  // When the camera badge is clicked, expo-image-picker on web opens a hidden
  // <input type="file">. Playwright's filechooser event fires when the browser
  // would show the native file dialog — we intercept and set files programmatically.
  const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10_000 });
  await cameraBadge.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });

  // ── 4. Wait for the upload to complete ───────────────────────────────────────
  // The app calls POST /users/avatar/upload-url → PUT <minio signed URL> →
  // POST /users/avatar/confirm. Wait for the confirm call to return.
  await page.waitForResponse(
    (resp) => resp.url().includes('/users/avatar/confirm') && resp.status() === 200,
    { timeout: 30_000 },
  );

  // ── 5. Assert the new avatar image renders ───────────────────────────────────
  // After confirmAvatar(), refreshProfile() is called which updates user.avatarBlobUrl
  // in the Zustand auth store. The Avatar component re-renders with the new imageUrl.
  // The new blob URL comes from MinIO and starts with http (inside compose network).
  const avatarImg = page.locator('img[src*="avatars/"]').or(page.locator('img[src*="minio"]')).or(page.locator('img[src*="/blob"]'));
  await expect(avatarImg.first()).toBeVisible({ timeout: 15_000 });

  // ── 6. Reload and assert persistence ─────────────────────────────────────────
  // On reload, the app calls restoreSession() → POST /auth/refresh, then
  // refreshProfile() → GET /users/me, which now returns the new avatarBlobUrl.
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // After reload the updated avatar src should still be present.
  await expect(avatarImg.first()).toBeVisible({ timeout: 15_000 });
});
