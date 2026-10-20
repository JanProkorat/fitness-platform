/**
 * Coach invite card in the Inbox thread: an outgoing card that stays in the
 * thread and only changes its label (Sent, Accepted, Declined, Cancelled,
 * Expired), the "Invite" row chip, the Invited right panel, and the
 * "Cancel invite" action with its error paths.
 *
 * The harness cannot be relied on to hold a pending invite thread at test
 * time, so the conversation list, the thread messages, the pending-clients
 * rows and the cancel call are stubbed. That keeps every card state and error
 * path deterministic. The stubs mirror the contract in `generated.ts`:
 * `ConversationDto.cooperation`, `MessageDto.eventStatus` / `eventSourceId`
 * and the DELETE /trainer/pending-invites/{id} cancel call.
 */
import type { Page } from '@playwright/test';
import { trainerTest as test, expect } from '../fixtures/auth';

const CONVERSATION_ID = '11111111-2222-3333-4444-555555555501';
const PARTICIPANT_ID = 'aaaaaaaa-0000-0000-0000-000000000501';
const INVITE_ID = '99999999-0000-0000-0000-000000000501';
const PARTICIPANT_NAME = 'Klara Nemcova';
const PARTICIPANT_EMAIL = 'klara.nemcova@example.test';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type CardStatus = 'Pending' | 'Accepted' | 'Declined' | 'Cancelled' | 'Expired';

interface StubOptions {
  status: CardStatus;
  /** Status code for the cancel (DELETE) call; 204 flips the invite to Cancelled. */
  cancelStatus?: number;
  /** Error code placed in the cancel response body for a failing call. */
  cancelErrorCode?: string;
  /** The status the invite really has after a refused cancel (e.g. the client already answered). */
  statusAfterRefusedCancel?: CardStatus;
}

interface StubState {
  status: CardStatus;
  cancelCalls: number;
}

function messages(status: CardStatus, sentAt: Date) {
  const items = [
    {
      id: 'msg-text',
      senderId: 'coach',
      text: 'Hi Klara, happy to put together a plan around your shifts.',
      timestamp: new Date(sentAt.getTime() + 1000).toISOString(),
      isRead: true,
      kind: 'Text',
    },
    {
      id: 'msg-invite',
      senderId: 'coach',
      text: '',
      timestamp: sentAt.toISOString(),
      isRead: true,
      kind: 'Event',
      eventType: 'Invited',
      eventSourceId: INVITE_ID,
      eventStatus: status,
    },
  ];
  // Newest first, like GET /conversations/{id}/messages.
  if (status === 'Cancelled') {
    items.unshift({
      id: 'msg-withdrawn',
      senderId: 'coach',
      text: '',
      timestamp: new Date().toISOString(),
      isRead: true,
      kind: 'Event',
      eventType: 'Withdrawn',
      eventSourceId: INVITE_ID,
      eventStatus: status,
    });
  }
  return items;
}

/** Stubs the inbox for one off-roster thread carrying a coach invite. */
async function stubInviteThread(page: Page, options: StubOptions, sentAt: Date): Promise<StubState> {
  const state: StubState = { status: options.status, cancelCalls: 0 };

  await page.route(
    (url) => url.pathname === '/conversations',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: CONVERSATION_ID,
            participant: { id: PARTICIPANT_ID, name: PARTICIPANT_NAME, initials: 'KN' },
            lastMessage: 'Hi Klara, happy to put together a plan around your shifts.',
            lastMessageAt: new Date().toISOString(),
            lastMessageIsOwn: true,
            unreadCount: 0,
            isFormer: false,
            isSendLocked: state.status === 'Pending',
            cooperation: { type: 'Invite', direction: 'Sent', status: state.status, sourceId: INVITE_ID, requestedScope: 'TrainingOnly' },
          },
        ]),
      }),
  );
  await page.route(
    (url) => url.pathname === `/conversations/${CONVERSATION_ID}/messages`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: messages(state.status, sentAt) }),
      }),
  );
  await page.route(
    (url) => url.pathname === `/conversations/${CONVERSATION_ID}/read`,
    (route) => route.fulfill({ status: 204 }),
  );
  await page.route(
    (url) => url.pathname === '/trainer/clients/pending',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rows:
            state.status === 'Pending'
              ? [{ kind: 'Invite', publicId: INVITE_ID, email: PARTICIPANT_EMAIL, sentAt: sentAt.toISOString() }]
              : [],
        }),
      }),
  );
  await page.route(
    (url) => url.pathname === `/trainer/pending-invites/${INVITE_ID}`,
    (route) => {
      state.cancelCalls += 1;
      const cancelStatus = options.cancelStatus ?? 204;
      if (cancelStatus === 204) {
        state.status = 'Cancelled';
        return route.fulfill({ status: 204 });
      }
      if (options.statusAfterRefusedCancel) {
        state.status = options.statusAfterRefusedCancel;
      }
      return route.fulfill({
        status: cancelStatus,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: cancelStatus, errorCode: options.cancelErrorCode ?? 'PENDING_INVITE_NOT_CANCELLABLE' }),
      });
    },
  );
  return state;
}

async function openThread(page: Page): Promise<void> {
  await page.goto('/inbox');
  await page.getByRole('button').filter({ has: page.getByText(PARTICIPANT_NAME, { exact: true }) }).click();
}

test.describe('coach invite card in the inbox thread', () => {
  test('a pending invite shows the outgoing card, the Invite chip and the Invited panel', async ({ page }) => {
    const sentAt = new Date(Date.now() - 3 * MS_PER_DAY);
    await stubInviteThread(page, { status: 'Pending' }, sentAt);
    await openThread(page);

    const card = page.getByTestId('invite-card');
    await expect(card).toBeVisible();
    await expect(card.getByText('Invitation sent')).toBeVisible();
    await expect(card.getByText(`${PARTICIPANT_NAME} · Personal training`)).toBeVisible();
    await expect(card.getByText(/Sent .* · expires in 4 days/)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Cancel invite' })).toBeVisible();

    await expect(page.getByTestId('inbox-row-chip')).toHaveText('Invite');

    const panel = page.getByTestId('invited-client-panel');
    await expect(panel.getByTestId('panel-status-chip')).toHaveText('Invited');
    await expect(panel.getByText('Not a client yet · waiting for Klara to accept')).toBeVisible();
    await expect(panel.getByText(PARTICIPANT_EMAIL)).toBeVisible();
    await expect(panel.getByText('Expires')).toBeVisible();
    // The dashboard 404 for an unlinked client must never surface as a load error.
    await expect(page.getByText('Failed to load the plan')).toHaveCount(0);
  });

  test('Cancel invite flips the card to "Invitation cancelled" and drops the button', async ({ page }) => {
    const sentAt = new Date(Date.now() - 3 * MS_PER_DAY);
    const state = await stubInviteThread(page, { status: 'Pending' }, sentAt);
    await openThread(page);

    await page.getByTestId('invite-card').getByRole('button', { name: 'Cancel invite' }).click();

    const card = page.getByTestId('invite-card');
    await expect(card.getByText('Invitation cancelled')).toBeVisible();
    await expect(card.getByText(/^You cancelled/)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Cancel invite' })).toHaveCount(0);
    expect(state.cancelCalls).toBe(1);
    // The Withdrawn event folds into the card instead of adding a grey pill.
    await expect(page.getByText('The collaboration offer was withdrawn')).toHaveCount(0);
    await expect(page.getByTestId('inbox-row-chip')).toHaveCount(0);
  });

  test('cancelling an invite the client already answered shows a readable toast and the real status', async ({ page }) => {
    const sentAt = new Date(Date.now() - 3 * MS_PER_DAY);
    await stubInviteThread(
      page,
      { status: 'Pending', cancelStatus: 409, cancelErrorCode: 'PENDING_INVITE_NOT_CANCELLABLE', statusAfterRefusedCancel: 'Accepted' },
      sentAt,
    );
    await openThread(page);

    await page.getByTestId('invite-card').getByRole('button', { name: 'Cancel invite' }).click();

    await expect(
      page.locator("[data-slot='toast']").filter({ hasText: 'This invitation can no longer be cancelled.' }),
    ).toBeVisible();
    const card = page.getByTestId('invite-card');
    await expect(card.getByText('Invitation accepted')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Cancel invite' })).toHaveCount(0);
  });

  for (const [status, label, subline] of [
    ['Accepted', 'Invitation accepted', /^Klara accepted/],
    ['Declined', 'Invitation declined', /^Klara declined/],
    ['Expired', 'Invitation expired', /^No answer within 7 days$/],
  ] as const) {
    test(`a ${status} invite keeps the card and changes only its label`, async ({ page }) => {
      const sentAt = new Date(Date.now() - 9 * MS_PER_DAY);
      await stubInviteThread(page, { status }, sentAt);
      await openThread(page);

      const card = page.getByTestId('invite-card');
      await expect(card.getByText(label)).toBeVisible();
      await expect(card.getByText(subline)).toBeVisible();
      await expect(card.getByText(`${PARTICIPANT_NAME} · Personal training`)).toBeVisible();
      await expect(card.getByRole('button')).toHaveCount(0);
      await expect(page.getByTestId('inbox-row-chip')).toHaveCount(0);
    });
  }
});
