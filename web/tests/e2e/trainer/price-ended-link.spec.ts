/**
 * A coach saving a client's price after the client ended the link sees the
 * "collaboration ended" toast and the ended view, not a generic save error.
 *
 * Runs in its own `trainer-ending` project: it ends the seeded QA Ending link,
 * which changes qa.trainer's roster and fires a notification, so it must run
 * after every other trainer spec. Needs the rich seed (QA Ending, live link,
 * no payment terms).
 */
import { request as apiRequest, type APIRequestContext } from '@playwright/test';
import { trainerTest as test, expect } from '../fixtures/auth';

// A retry after the DELETE can never pass: /test/reset runs once per run, so the link stays ended.
test.describe.configure({ mode: 'serial', retries: 0 });

const API_URL = process.env['E2E_API_URL'] ?? 'https://localhost:5101';
const TRAINER_EMAIL = 'qa.trainer@formup.test';
const CLIENT_EMAIL = 'qa.client.ending@formup.test';
// Trainer-side client id of the seeded "QA Ending" client.
const ENDING_CLIENT_ID = '10101010-1010-1010-aaaa-000000000001';

interface LoginBody {
  accessToken: string;
}

interface CollaborationsBody {
  collaborations: Array<{ publicId: string; professionalPublicId: string }>;
}

function seedPassword(): string {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  return password;
}

async function login(api: APIRequestContext, email: string): Promise<Record<string, string>> {
  const response = await api.post('/auth/login', { data: { email, password: seedPassword() } });
  expect(response.status(), `POST /auth/login for ${email}`).toBe(200);
  const { accessToken } = (await response.json()) as LoginBody;
  return { Authorization: `Bearer ${accessToken}` };
}

test.describe('ended link price save', () => {
  let api: APIRequestContext;
  let coachAuth: Record<string, string>;
  let packageId: string | undefined;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: API_URL, ignoreHTTPSErrors: true });
    coachAuth = await login(api, TRAINER_EMAIL);

    const created = await api.post('/payments/packages', {
      headers: coachAuth,
      data: { name: `QA ended link ${Date.now()}`, price: 1000 },
    });
    expect(created.status(), 'POST /payments/packages').toBe(201);
    packageId = ((await created.json()) as { packageId: string }).packageId;
  });

  test.afterAll(async () => {
    try {
      if (packageId) {
        // Tolerate a non-2xx: the archive may refuse once the ended link's terms reference the package.
        await api.post(`/payments/packages/${packageId}/archive`, { headers: coachAuth });
      }
    } finally {
      await api.dispose();
    }
  });

  test('saving a price after the client ended the link shows the ended toast and view', async ({ page }) => {
    // The coach's page must stay stale: no SignalR push of the ended link.
    await page.route('**/hubs/**', (route) => route.abort());
    // A toast is also echoed into an aria-live region, so match the visible title only.
    const toastTitle = (text: string) => page.locator('[data-slot="toast-title"]').filter({ hasText: text });

    await page.goto(`/clients/${ENDING_CLIENT_ID}/payment`);
    const packageSelect = page.getByLabel('Package', { exact: true });
    await expect(packageSelect).toBeVisible({ timeout: 30_000 });
    await packageSelect.selectOption(packageId!);

    // Control: the same save succeeds while the link is live.
    await page.getByRole('button', { name: 'Save price' }).click();
    await expect(toastTitle('Price saved.')).toBeVisible();

    // The client ends the link behind the coach page's back.
    const clientAuth = await login(api, CLIENT_EMAIL);
    const collaborationsResponse = await api.get('/client/collaborations', { headers: clientAuth });
    expect(collaborationsResponse.status(), 'GET /client/collaborations').toBe(200);
    const { collaborations } = (await collaborationsResponse.json()) as CollaborationsBody;
    if (collaborations.length === 0) {
      throw new Error('QA Ending has no active collaboration: fixture already ended; run /test/reset.');
    }
    const ended = await api.delete(`/client/collaborations/${collaborations[0].publicId}`, { headers: clientAuth });
    expect(ended.status(), 'DELETE /client/collaborations/{publicId}').toBe(204);

    // Save again on the stale page: make the form dirty with a custom price.
    await page.getByRole('switch', { name: 'Custom price' }).click();
    await page.getByLabel('Custom price per period').fill('1200');
    await page.getByRole('button', { name: 'Save price' }).click();

    await expect(
      toastTitle('The collaboration with this client has ended, so the price can no longer be changed.'),
    ).toBeVisible();
    await expect(toastTitle('Could not save the price.')).toHaveCount(0);
    // The aria-live region repeats toast copy; a generic error must not appear there either.
    await expect(page.getByText('Could not save the price.')).toHaveCount(0);
    // Ended view: shown in place of the price form, not a blank or error page.
    await expect(page.getByTestId('collaboration-ended')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save price' })).toHaveCount(0);
    await expect(packageSelect).toHaveCount(0);
  });
});
