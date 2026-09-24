/**
 * #1100 — Cooperation-event banners in the nutritionist's inbox (the accept
 * half of `trainer/inbox-cooperation-events.spec.ts`'s decline flow).
 *
 * QA fixture: qa.client2 (`QaSeedRunner.Client2Email`) starts UNLINKED from
 * qa.nutri — its only seeded link is with qa.trainer2 (Training profession),
 * so qa.client2's Nutrition slot is free. `global-setup.ts` calls POST
 * /test/reset before this project runs, so qa.client2 is guaranteed unlinked
 * from qa.nutri at the start of every run.
 *
 * This flow runs against qa.nutri rather than qa.trainer specifically
 * because AcceptClientRequestEndpoint enforces #1009's one-coach-per-
 * profession rule: qa.client2's seeded qa.trainer2 link already occupies its
 * Training slot, so qa.trainer accepting a second Training request 400s with
 * PROFESSION_ALREADY_OCCUPIED — a real business rule, not a defect in #1100.
 * Accepting into the (free) Nutrition slot via qa.nutri has no such conflict.
 * The sibling decline test stays on qa.trainer instead, since
 * RejectClientRequestEndpoint has no profession-slot check. The two tests no
 * longer share a professional and don't interfere with each other — no
 * ordering dependency between this file and the trainer one.
 *
 * Coach-side pending/declined/withdrawn threads only ever appear under the All
 * filter chip — an off-roster conversation (no live link) is loaded only when
 * the request filter is All (`GetConversationsEndpoint.cs:118-124`). Every
 * `/inbox` visit below explicitly reselects it via the dropdown rather than
 * relying on the page's own All-by-default initial state, so this spec keeps
 * catching a regression even if that default ever changes.
 *
 * The accept action itself is driven through the Clients page's existing
 * Pending tab (`PendingTable.tsx`) — the inbox thread has no accept/decline
 * affordance of its own on web (RULING (6): `GET /conversations/{id}/context`
 * is mobile-only and web never calls it). Both `AcceptClientRequestEndpoint`
 * and `PendingTable.tsx`'s route are role-agnostic between Trainer and
 * Nutritionist, so this drives identically to the trainer-side flow.
 */
import { request as apiRequest, type APIRequestContext, type Page } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const CLIENT2_EMAIL = 'qa.client2@fitnessplatform.test';
/** QaSeedRunner.NutriProfilePublicId — qa.nutri's ProfessionalProfile.PublicId. */
const NUTRITIONIST_PROFESSIONAL_PUBLIC_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
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
 * Sends a fresh client request from qa.client2 to qa.nutri. Throws with the
 * response status + body on failure — rather than a bare `expect(...).toBe(true)`
 * — so a leftover Pending request from a previous failed run
 * (RequestAlreadyPending), or a profession-slot conflict
 * (PROFESSION_ALREADY_OCCUPIED), reads as exactly that in the test output,
 * instead of a bare "expected true, received false" that gives no hint the
 * cause is upstream state, not this call.
 */
async function sendClient2Request(api: APIRequestContext, accessToken: string, message: string): Promise<void> {
  const response = await api.post('/client/requests', {
    data: { professionalPublicId: NUTRITIONIST_PROFESSIONAL_PUBLIC_ID, message },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `[inbox-cooperation-events] POST /client/requests as qa.client2 (-> qa.nutri) returned ` +
        `${response.status()} ${response.statusText()}: ${body}. If this is ` +
        'RequestAlreadyPending, qa.client2 has a leftover Pending request against qa.nutri ' +
        'from an earlier failed run.',
    );
  }
}

/**
 * Opens the filter dropdown and explicitly (re)selects "All" — the only chip
 * that surfaces an off-roster (no live link) conversation. Same trigger-button
 * pattern as `trainer/inbox.spec.ts`'s filter-parity test: the default
 * `ClientListFilter.All` state means the trigger is already labelled "All (n)"
 * on a fresh `/inbox` visit.
 */
async function selectAllFilter(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^All \(\d+\)$/ }).click();
  await page.getByRole('menuitem', { name: /^All \(/ }).click();
  await page.waitForLoadState('networkidle');
}

/** The inbox list row for qa.client2, scoped to an exact name match (same reasoning as
 * `trainer/inbox.spec.ts`'s `qaClientRow` — "QA Client2" would otherwise also match a
 * substring search against "QA Client"/"QA Client3"). */
function client2Row(page: Page) {
  return page.getByRole('button').filter({ has: page.getByText(CLIENT2_DISPLAY_NAME, { exact: true }) });
}

test.describe('inbox cooperation-event banners (#1100)', () => {
  test('a client request the nutritionist accepts shows the Requested banner, then the Accepted banner, in both the thread and the list preview', async ({
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
    // list preview when the event itself is the newest row — see the Accepted
    // assertion below, where the accept carries no statement.
    await expect(requestedRow.getByText('Hi, I would like to work with you.')).toBeVisible();

    await requestedRow.click();
    await page.waitForLoadState('networkidle');
    // Inside the thread both rows render: the Requested banner, then the message bubble.
    await expect(page.getByText('QA Client2 asked to collaborate with you').last()).toBeVisible();

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
