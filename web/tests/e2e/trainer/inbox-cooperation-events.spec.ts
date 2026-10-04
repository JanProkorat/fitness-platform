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
 * This file drives ONLY the decline (reject) flow against qa.trainer. The
 * matching accept flow lives in `tests/e2e/nutritionist/inbox-cooperation-events.spec.ts`,
 * driven against qa.nutri instead of qa.trainer: qa.client2's seeded link with
 * qa.trainer2 already occupies its Training profession slot, so
 * AcceptClientRequestEndpoint correctly 400s with PROFESSION_ALREADY_OCCUPIED
 * (#1009 one-coach-per-profession) when qa.trainer tries to accept — that's
 * this repo's real business rule, not a defect in #1100. qa.client2's
 * Nutrition slot is free, so qa.nutri can accept it. Declining doesn't touch
 * the profession-slot check (RejectClientRequestEndpoint has no such guard),
 * so it stays here against qa.trainer. The two tests no longer share a
 * professional and don't interfere with each other, so there is no ordering
 * dependency between this file and the nutritionist one.
 *
 * Coach-side pending/declined/withdrawn threads only ever appear under the All
 * filter chip — an off-roster conversation (no live link) is loaded only when
 * the request filter is All (`GetConversationsEndpoint.cs:118-124`). Every
 * `/inbox` visit below explicitly reselects it via the dropdown rather than
 * relying on the page's own All-by-default initial state, so this spec keeps
 * catching a regression even if that default ever changes.
 *
 * The decline action itself is driven through the Clients page's existing
 * Pending tab (`PendingTable.tsx`) — the inbox thread has no accept/decline
 * affordance of its own on web (RULING (6): `GET /conversations/{id}/context`
 * is mobile-only and web never calls it).
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
      `[inbox-cooperation-events] POST /client/requests as qa.client2 (-> qa.trainer) returned ` +
        `${response.status()} ${response.statusText()}: ${body}. If this is ` +
        'RequestAlreadyPending, qa.client2 has a leftover Pending request against qa.trainer ' +
        'from an earlier failed run.',
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
});

const STUB_CONVERSATION_ID = '11111111-2222-3333-4444-555555555555';
const STUB_PARTICIPANT_NAME = 'Stub Invitee';

/**
 * Stubs the conversation list with a single off-roster thread so the lock
 * state is deterministic: the harness cannot be relied on to hold a pending
 * invite thread at test time. `sendStatus` drives what a send attempt gets.
 */
async function stubInviteThread(page: Page, isSendLocked: boolean, sendStatus?: number): Promise<void> {
  await page.route(
    (url) => url.pathname === '/conversations',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: STUB_CONVERSATION_ID,
            participant: { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: STUB_PARTICIPANT_NAME, initials: 'SI' },
            lastMessage: 'Invitation',
            lastMessageAt: new Date().toISOString(),
            lastMessageIsOwn: true,
            unreadCount: 0,
            isFormer: false,
            isSendLocked,
          },
        ]),
      }),
  );
  await page.route(
    (url) => url.pathname === `/conversations/${STUB_CONVERSATION_ID}/messages`,
    (route) => {
      if (route.request().method() === 'POST' && sendStatus) {
        return route.fulfill({
          status: sendStatus,
          contentType: 'application/problem+json',
          body: JSON.stringify({ status: sendStatus, errorCode: 'CONVERSATION_LOCKED' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    },
  );
  await page.route(
    (url) => url.pathname === `/conversations/${STUB_CONVERSATION_ID}/read`,
    (route) => route.fulfill({ status: 204 }),
  );
}

test.describe('locked invite-only thread', () => {
  test('a locked thread shows the notice and a disabled composer', async ({ page }) => {
    await stubInviteThread(page, true);
    await page.goto('/inbox');
    await page.getByRole('button').filter({ has: page.getByText(STUB_PARTICIPANT_NAME, { exact: true }) }).click();

    await expect(page.getByTestId('composer-locked-notice')).toHaveText(
      'You can reply once the client accepts your invitation.',
    );
    await expect(page.getByPlaceholder('Type your message here...')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Send message' })).toHaveCount(0);
  });

  test('an unlocked thread keeps the normal composer', async ({ page }) => {
    await stubInviteThread(page, false);
    await page.goto('/inbox');
    await page.getByRole('button').filter({ has: page.getByText(STUB_PARTICIPANT_NAME, { exact: true }) }).click();

    await expect(page.getByTestId('composer-locked-notice')).toHaveCount(0);
    await expect(page.getByPlaceholder('Type your message here...')).toBeEnabled();
  });

  test('a send refused with a top-level CONVERSATION_LOCKED errorCode shows the readable toast', async ({ page }) => {
    await stubInviteThread(page, false, 403);
    await page.goto('/inbox');
    await page.getByRole('button').filter({ has: page.getByText(STUB_PARTICIPANT_NAME, { exact: true }) }).click();

    const composer = page.getByPlaceholder('Type your message here...');
    await composer.fill('hello');
    await composer.press('Enter');

    await expect(
      page.locator("[data-slot='toast']").filter({ hasText: 'You can reply once the client accepts your invitation.' }),
    ).toBeVisible();
  });
});
