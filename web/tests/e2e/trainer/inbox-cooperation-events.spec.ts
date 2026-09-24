/**
 * #1100 — Cooperation-event banners in the coach's inbox (invite/request/accept/
 * decline/withdraw rendered inline in the thread and as the list preview).
 *
 * QA fixture: qa.client2 (`QaSeedRunner.Client2Email`) starts UNLINKED from
 * qa.trainer — its seeded link is with qa.trainer2 instead — so it's the one QA
 * account free to drive a fresh client-request flow without colliding with
 * #1095's already-linked qa.client/qa.client3 fixtures. `global-setup.ts` calls
 * POST /test/reset before this project runs, so qa.client2 is guaranteed
 * unlinked at the start of every run.
 *
 * The two tests below share that one account and MUST stay in declared order:
 * "declines" first (rejecting leaves qa.client2 still unlinked, free to send a
 * second request), "accepts" second (accepting creates a permanent link, so a
 * third scenario reusing qa.client2 would 400 with ALREADY_LINKED). Playwright
 * runs a single file's tests serially by default (`fullyParallel` is not set in
 * playwright.config.ts), so this ordering is safe within one run.
 *
 * Coach-side pending/declined/withdrawn threads only ever appear under the All
 * filter chip — an off-roster conversation (no live link) is loaded only when
 * the request filter is All (`GetConversationsEndpoint.cs:118-124`). Every
 * `/inbox` visit below explicitly reselects it via the dropdown rather than
 * relying on the page's own All-by-default initial state, so this spec keeps
 * catching a regression even if that default ever changes.
 *
 * The accept/reject action itself is driven through the Clients page's
 * existing Pending tab (`PendingTable.tsx`) — the inbox thread has no
 * accept/decline affordance of its own on web (RULING (6): `GET
 * /conversations/{id}/context` is mobile-only and web never calls it).
 */
import { request as apiRequest, type APIRequestContext, type Page } from '@playwright/test';
import { trainerTest as test, expect } from '../fixtures/auth';

const CLIENT2_EMAIL = 'qa.client2@fitnessplatform.test';
/** QaSeedRunner.TrainerProfilePublicId — qa.trainer's ProfessionalProfile.PublicId. */
const TRAINER_PROFESSIONAL_PUBLIC_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CLIENT2_DISPLAY_NAME = 'QA Client2';

interface LoginResponseBody {
  accessToken: string;
}

/**
 * Logs in as qa.client2 via a bare API context — this spec only calls REST
 * endpoints directly as the client, never drives qa.client2 through a page, so
 * a full browser context (see `openClientContext` in `../fixtures/auth.ts`) is
 * unnecessary overhead.
 */
async function loginAsClient2(baseURL: string): Promise<{ api: APIRequestContext; accessToken: string }> {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('[inbox-cooperation-events] QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  const response = await api.post('/auth/login', { data: { email: CLIENT2_EMAIL, password } });
  if (!response.ok()) {
    throw new Error(`[inbox-cooperation-events] login as qa.client2 returned ${response.status()} ${response.statusText()}.`);
  }
  const { accessToken } = (await response.json()) as LoginResponseBody;
  return { api, accessToken };
}

/**
 * Sends a fresh client request from qa.client2 to qa.trainer. Throws with the
 * response status + body on failure — rather than a bare `expect(...).toBe(true)`
 * — so a leftover Pending request from a previous failed run (RequestAlreadyPending)
 * reads as exactly that in the test output, instead of a bare "expected true,
 * received false" that gives no hint the cause is upstream state, not this call.
 */
async function sendClient2Request(api: APIRequestContext, accessToken: string, message: string): Promise<void> {
  const response = await api.post('/client/requests', {
    data: { professionalPublicId: TRAINER_PROFESSIONAL_PUBLIC_ID, message },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `[inbox-cooperation-events] POST /client/requests as qa.client2 returned ` +
        `${response.status()} ${response.statusText()}: ${body}. If this is ` +
        'RequestAlreadyPending, qa.client2 has a leftover Pending request from an ' +
        'earlier failed run — the decline test must reject it before the accept ' +
        'test can send a second one.',
    );
  }
}

/**
 * Opens the filter dropdown and explicitly (re)selects "All" — the only chip
 * that surfaces an off-roster (no live link) conversation. Same trigger-button
 * pattern as `inbox.spec.ts`'s filter-parity test: the default `ClientListFilter.All`
 * state means the trigger is already labelled "All (n)" on a fresh `/inbox` visit.
 */
async function selectAllFilter(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^All \(\d+\)$/ }).click();
  await page.getByRole('menuitem', { name: /^All \(/ }).click();
  await page.waitForLoadState('networkidle');
}

/** The inbox list row for qa.client2, scoped to an exact name match (same reasoning as
 * `inbox.spec.ts`'s `qaClientRow` — "QA Client2" would otherwise also match a
 * substring search against "QA Client"/"QA Client3"). */
function client2Row(page: Page) {
  return page.getByRole('button').filter({ has: page.getByText(CLIENT2_DISPLAY_NAME, { exact: true }) });
}

test.describe('inbox cooperation-event banners (#1100)', () => {
  test('a client request the coach declines shows the Requested banner, then the Declined banner, in both the thread and the list preview', async ({
    page,
    baseURL,
  }) => {
    const { api, accessToken } = await loginAsClient2(baseURL ?? 'http://localhost:5173');
    try {
      await sendClient2Request(api, accessToken, 'Hi, I would like to work with you.');
    } finally {
      await api.dispose();
    }

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await selectAllFilter(page);

    const requestedRow = client2Row(page);
    await expect(requestedRow).toBeVisible();
    // The Requested event is immediately followed by the request's own Text message
    // (ConversationSeedService.AppendCooperationEventAsync writes [event, message] in
    // one batch for a non-blank message), so the MESSAGE — not the event — is the
    // newest row: LastMessageEventType resets to null and the list preview reads the
    // message text, not the "asked to collaborate" banner. The banner only becomes the
    // list preview when the event itself is the newest row — see the Declined
    // assertion below, where the reject carries no statement.
    await expect(requestedRow.getByText('Hi, I would like to work with you.')).toBeVisible();

    await requestedRow.click();
    await page.waitForLoadState('networkidle');
    // Inside the thread both rows render: the Requested banner, then the message bubble.
    await expect(page.getByText('QA Client2 asked to collaborate with you').last()).toBeVisible();

    await page.goto('/clients?tab=Pending');
    await page.waitForLoadState('networkidle');
    const pendingRow = page.getByRole('row', { name: /QA Client2/ });
    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole('button', { name: 'Reject' }).click();
    await expect(pendingRow).toHaveCount(0);

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await selectAllFilter(page);

    const declinedRow = client2Row(page);
    await expect(declinedRow.getByText("You declined QA Client2's request")).toBeVisible();
    await declinedRow.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText("You declined QA Client2's request").last()).toBeVisible();
  });

  test('a client request the coach accepts shows the Requested banner, then the Accepted banner, in both the thread and the list preview', async ({
    page,
    baseURL,
  }) => {
    const { api, accessToken } = await loginAsClient2(baseURL ?? 'http://localhost:5173');
    try {
      await sendClient2Request(api, accessToken, 'Hi again, I would like to work with you.');
    } finally {
      await api.dispose();
    }

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await selectAllFilter(page);

    const requestedRow = client2Row(page);
    await expect(requestedRow).toBeVisible();
    // Same reasoning as the decline test above: the request's own Text message is the
    // newest row, so the list preview reads the message text, not the event banner.
    await expect(requestedRow.getByText('Hi again, I would like to work with you.')).toBeVisible();

    await page.goto('/clients?tab=Pending');
    await page.waitForLoadState('networkidle');
    const pendingRow = page.getByRole('row', { name: /QA Client2/ });
    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole('button', { name: 'Accept' }).click();
    await expect(pendingRow).toHaveCount(0);

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await selectAllFilter(page);

    const acceptedRow = client2Row(page);
    await expect(acceptedRow.getByText("You accepted QA Client2's request")).toBeVisible();
    await acceptedRow.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText("You accepted QA Client2's request").last()).toBeVisible();
  });
});
