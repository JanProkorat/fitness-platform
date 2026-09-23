/**
 * #1096 — Chat image attachments (web slice). Path is under trainer/, but
 * playwright.config.ts runs it under its own `trainer-media` project (not
 * `trainer`) because it mutates the seeded QA Client conversation's read
 * state, which inbox.spec.ts and clients.spec.ts depend on staying unread.
 * `trainer-media` depends on `trainer` so it always runs last. Reuses
 * #1095's QA seed: a conversation between qa.trainer and "QA Client".
 *
 * Fixtures: `../fixtures/chat-image.jpg` (a genuine tiny JPEG) and
 * `../fixtures/chat-image-disguised.jpg` (a plain-text file with a `.jpg`
 * extension — browsers report its `File.type` from the extension, not the
 * bytes, so it would slip past the composer's client-side check; the server
 * sniff is the only thing that actually rejects it). The disguised-file test
 * therefore bypasses the UI entirely and drives the two-step upload API
 * directly, mirroring `openClientContext`'s direct-POST pattern in
 * inbox.spec.ts.
 */
import { request as apiRequest, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { trainerTest as test, expect, openClientContext } from '../fixtures/auth';

const TRAINER_EMAIL = 'qa.trainer@fitnessplatform.test';

const VALID_IMAGE_PATH = path.resolve('tests/e2e/fixtures/chat-image.jpg');
const DISGUISED_IMAGE_PATH = path.resolve('tests/e2e/fixtures/chat-image-disguised.jpg');

interface LoginResponseBody {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  emailConfirmed: boolean;
}

interface UploadUrlResponseBody {
  uploadUrl: string;
  uploadId: string;
}

/**
 * The inbox list row button for the "QA Client" conversation, scoped to an
 * exact name match — same scoping as inbox.spec.ts's `qaClientRow` (see that
 * file's header comment for why the seeded conversation-less "QA Client3"
 * roster entry otherwise makes this a strict-mode violation).
 */
function qaClientRow(page: Page): Locator {
  return page.getByRole('button').filter({ has: page.getByText('QA Client', { exact: true }) });
}

/**
 * Reads the QA-Client conversation id off the app's own authenticated
 * `/conversations` request — same id-recovery pattern as inbox.spec.ts's
 * realtime tests (a raw same-origin fetch from `page.evaluate` would skip
 * the app's axios Bearer-token interceptor).
 */
async function getQaClientConversationId(page: Page): Promise<string> {
  const listResponsePromise = page.waitForResponse((r) => r.url().includes('/conversations?') && r.status() === 200);
  await page.goto('/inbox');
  const listBody = (await (await listResponsePromise).json()) as Array<{
    id?: string;
    participant?: { name?: string };
  }>;
  const match = listBody.find((r) => r.participant?.name?.includes('QA Client'));
  if (!match?.id) {
    throw new Error('QA Client conversation id not found');
  }
  return match.id;
}

/**
 * Mints a fresh access token for `email` via POST /auth/login — a per-call
 * login (not a shared/cached token) so this spec's direct-API requests never
 * replay a token another context/attempt has already rotated (same rationale
 * as fixtures/auth.ts's per-attempt `storageState` and `openClientContext`).
 */
async function loginForAccessToken(baseURL: string, email: string): Promise<string> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[inbox-attachments] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }

  const apiContext = await apiRequest.newContext({ baseURL });
  try {
    const response = await apiContext.post('/auth/login', { data: { email, password } });
    if (!response.ok()) {
      throw new Error(`[inbox-attachments] POST /auth/login for "${email}" returned ${response.status()}.`);
    }
    return ((await response.json()) as LoginResponseBody).accessToken;
  } finally {
    await apiContext.dispose();
  }
}

test.describe('inbox chat image attachments', () => {
  test('an image-only message uploads and renders in the thread, and the list row shows the photo marker', async ({
    page,
  }) => {
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await qaClientRow(page).click();
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="file"]').setInputFiles(VALID_IMAGE_PATH);
    await expect(page.getByAltText('Image preview')).toBeVisible();

    await page.getByRole('button', { name: 'Send message' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="thread-message-list"] img[alt="Attached image"]').last()).toBeVisible({
      timeout: 10_000,
    });
    // Image-only send: LastMessageText is empty, so the row falls back to the localized marker.
    await expect(qaClientRow(page).getByText('📷 Photo', { exact: true })).toBeVisible();
  });

  test('an image with a caption renders the image and the caption text below it', async ({ page }) => {
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await qaClientRow(page).click();
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="file"]').setInputFiles(VALID_IMAGE_PATH);
    await expect(page.getByAltText('Image preview')).toBeVisible();

    const uniqueCaption = `QA image caption ${Date.now()}`;
    await page.getByPlaceholder('Type your message here...').fill(uniqueCaption);
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="thread-message-list"] img[alt="Attached image"]').last()).toBeVisible({
      timeout: 10_000,
    });
    // Own bubble's caption and the row's updated preview line both carry the same text —
    // `.last()` disambiguates, same pattern as inbox.spec.ts's plain-text send test.
    await expect(page.getByText(uniqueCaption, { exact: true }).last()).toBeVisible();
  });

  test('an oversized image is rejected client-side with an inline error, and no upload request is sent', async ({
    page,
  }) => {
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await qaClientRow(page).click();
    await page.waitForLoadState('networkidle');

    let uploadUrlRequested = false;
    page.on('request', (request) => {
      if (request.url().includes('/messages/image-upload-url')) {
        uploadUrlRequested = true;
      }
    });

    // 6 MiB — over the server's 5 MiB cap. An in-memory buffer rather than a committed
    // fixture; only the client-side size check runs against it, never actually uploaded.
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0x00);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'oversized.jpg',
      mimeType: 'image/jpeg',
      buffer: oversizedBuffer,
    });

    await expect(page.getByText(/too large/i)).toBeVisible();
    await expect(page.getByAltText('Image preview')).toHaveCount(0);
    expect(uploadUrlRequested).toBe(false);
  });

  test('a disguised non-image file bypassing the client-side check is rejected by the server', async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const conversationId = await getQaClientConversationId(page);
    const accessToken = await loginForAccessToken(origin, TRAINER_EMAIL);

    const apiContext = await apiRequest.newContext({ baseURL: origin });
    try {
      const disguisedBytes = readFileSync(DISGUISED_IMAGE_PATH);

      const uploadUrlResponse = await apiContext.post(`/conversations/${conversationId}/messages/image-upload-url`, {
        data: { contentType: 'image/jpeg', sizeBytes: disguisedBytes.length },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(uploadUrlResponse.ok()).toBe(true);
      const { uploadUrl, uploadId } = (await uploadUrlResponse.json()) as UploadUrlResponseBody;

      const putResponse = await apiContext.put(uploadUrl, {
        data: disguisedBytes,
        headers: { 'Content-Type': 'image/jpeg' },
      });
      expect(putResponse.ok()).toBe(true);

      // The server re-sniffs the staged bytes' magic-byte signature — a renamed text file
      // matches none of the jpeg/png/webp signatures, so this must 400 despite the PUT succeeding.
      const sendResponse = await apiContext.post(`/conversations/${conversationId}/messages`, {
        data: { imageUploadId: uploadId },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(sendResponse.status()).toBe(400);
      const body = (await sendResponse.json()) as { errorCode?: string };
      expect(body.errorCode).toBe('INVALID_IMAGE_CONTENT_TYPE');
    } finally {
      await apiContext.dispose();
    }
  });

  test('the recipient sees a client-sent image live via newmessage, no reload needed', async ({
    page,
    browser,
    baseURL,
  }) => {
    const origin = baseURL ?? 'http://localhost:5173';
    const conversationId = await getQaClientConversationId(page);

    await qaClientRow(page).click();
    await page.waitForLoadState('networkidle');

    const { context: clientContext, accessToken } = await openClientContext(browser, origin);

    try {
      const clientApi = await clientContext.request;
      const validBytes = readFileSync(VALID_IMAGE_PATH);

      const uploadUrlResponse = await clientApi.post(`/conversations/${conversationId}/messages/image-upload-url`, {
        data: { contentType: 'image/jpeg', sizeBytes: validBytes.length },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(uploadUrlResponse.ok()).toBe(true);
      const { uploadUrl, uploadId } = (await uploadUrlResponse.json()) as UploadUrlResponseBody;

      const putResponse = await clientApi.put(uploadUrl, {
        data: validBytes,
        headers: { 'Content-Type': 'image/jpeg' },
      });
      expect(putResponse.ok()).toBe(true);

      const sendResponse = await clientApi.post(`/conversations/${conversationId}/messages`, {
        data: { imageUploadId: uploadId },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(sendResponse.ok()).toBe(true);

      // Trainer's thread was already open before the client sent — this must arrive via the
      // `newmessage` SignalR push, with no page.reload() anywhere in this test.
      await expect(page.locator('[data-testid="thread-message-list"] img[alt="Attached image"]').last()).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await clientContext.close();
    }
  });
});
