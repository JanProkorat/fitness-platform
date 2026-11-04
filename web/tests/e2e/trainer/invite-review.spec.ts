/**
 * Coach-side review of a client request (#1906): the request card with its package line, the review drawer
 * (package chosen by the client, and no package), the discount picker, the proposal-sent card with Withdraw,
 * and the Pending table's Package column.
 *
 * The harness cannot be relied on to hold a request that carries a package, so the conversation list, the
 * thread, the incoming requests, the coach's packages, discounts and forms, and the answering calls are all
 * stubbed. The stubs mirror the contract in `generated.ts` (`IncomingClientRequestDto`, `PendingClientRow`,
 * `MessageDto`, the accept / propose-package / withdraw-proposal endpoints).
 */
import type { Page, Route } from '@playwright/test';
import { trainerTest as test, expect } from '../fixtures/auth';

const CONVERSATION_ID = '11111111-2222-3333-4444-555555555601';
const PARTICIPANT_ID = 'aaaaaaaa-0000-0000-0000-000000000601';
const REQUEST_ID = '99999999-0000-0000-0000-000000000601';
const MONTHLY_ID = 'bbbbbbbb-0000-0000-0000-000000000611';
const LONG_TERM_ID = 'bbbbbbbb-0000-0000-0000-000000000612';
const LOYAL_ID = 'cccccccc-0000-0000-0000-000000000621';
const STUDENT_ID = 'cccccccc-0000-0000-0000-000000000622';
const FORM_ID = 'dddddddd-0000-0000-0000-000000000631';
const PARTICIPANT_NAME = 'Adam Bartos';
const MS_PER_MINUTE = 60 * 1000;

type RequestState = 'Pending' | 'PackageProposed' | 'Accepted' | 'Declined';

interface StubOptions {
  /** The package the client attached to the request; none by default. */
  clientPackage?: typeof MONTHLY;
  shareHistory?: boolean;
  /** Status code for the accept call; 204 accepts the request. */
  acceptStatus?: number;
  acceptErrorCode?: string;
}

interface StubState {
  status: RequestState;
  proposalCardStatus: 'Pending' | 'Cancelled' | 'Accepted' | 'Declined';
  withdrawn: boolean;
  acceptBodies: Record<string, unknown>[];
  proposeBodies: Record<string, unknown>[];
  withdrawCalls: number;
}

const MONTHLY = { publicId: MONTHLY_ID, name: 'Monthly coaching', billing: 'Monthly', price: 1800, currency: 'CZK' };

const COACH_PACKAGES = [
  { packageId: MONTHLY_ID, name: 'Monthly coaching', billing: 'Monthly', price: 1800, currency: 'CZK', showOnProfile: true, clientCount: 0 },
  { packageId: LONG_TERM_ID, name: 'Long-term coaching', billing: 'EveryNWeeks', intervalWeeks: 5, price: 5000, currency: 'CZK', showOnProfile: true, clientCount: 0 },
];

const COACH_DISCOUNTS = [
  { discountId: LOYAL_ID, name: 'Loyal client', type: 'Percentage', value: 10, duration: 'EveryPayment', scope: 'AllPackages', packageIds: [], usedByCount: 0 },
  {
    discountId: STUDENT_ID,
    name: 'Student',
    type: 'FixedAmount',
    value: 300,
    currency: 'CZK',
    duration: 'EveryPayment',
    scope: 'SelectedPackages',
    packageIds: [LONG_TERM_ID],
    usedByCount: 0,
  },
];

const FORMS = [
  {
    publicId: FORM_ID,
    title: 'Client Onboarding Form',
    type: 'Onboarding',
    isActive: true,
    isDefault: true,
    questionCount: 9,
    usedForClientCount: 0,
    dateCreated: new Date().toISOString(),
    editedAt: new Date().toISOString(),
  },
];

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function thread(state: StubState, sentAt: Date) {
  // Newest first, like GET /conversations/{id}/messages.
  const items: Record<string, unknown>[] = [];
  const cardStatus = state.status === 'Declined' ? 'Declined' : state.status === 'Accepted' ? 'Accepted' : 'Pending';
  if (state.withdrawn) {
    items.push({
      id: 'msg-withdrawn',
      senderId: 'coach',
      text: '',
      timestamp: new Date(sentAt.getTime() + 20 * MS_PER_MINUTE).toISOString(),
      isRead: true,
      kind: 'Event',
      eventType: 'Withdrawn',
      eventSourceId: REQUEST_ID,
      eventStatus: 'Cancelled',
    });
  }
  if (state.status === 'PackageProposed' || state.withdrawn) {
    items.push({
      id: 'msg-proposal',
      senderId: 'coach',
      text: '',
      timestamp: new Date(sentAt.getTime() + 10 * MS_PER_MINUTE).toISOString(),
      isRead: true,
      kind: 'Event',
      eventType: 'ProposalSent',
      eventSourceId: REQUEST_ID,
      eventStatus: state.withdrawn ? 'Cancelled' : state.proposalCardStatus,
    });
  }
  items.push(
    {
      id: 'msg-text',
      senderId: PARTICIPANT_ID,
      text: "Hi, I'd like to get stronger.",
      timestamp: new Date(sentAt.getTime() + 1000).toISOString(),
      isRead: true,
      kind: 'Text',
    },
    {
      id: 'msg-request',
      senderId: PARTICIPANT_ID,
      text: '',
      timestamp: sentAt.toISOString(),
      isRead: true,
      kind: 'Event',
      eventType: 'Requested',
      eventSourceId: REQUEST_ID,
      eventStatus: cardStatus,
    },
  );
  return items;
}

/** Stubs the inbox, the request list and the offer pickers for one off-roster thread carrying a client request. */
async function stubRequestThread(page: Page, options: StubOptions = {}): Promise<StubState> {
  const sentAt = new Date(Date.now() - 30 * MS_PER_MINUTE);
  const state: StubState = {
    status: 'Pending',
    proposalCardStatus: 'Pending',
    withdrawn: false,
    acceptBodies: [],
    proposeBodies: [],
    withdrawCalls: 0,
  };

  await page.route(
    (url) => url.pathname === '/conversations',
    (route) =>
      json(route, [
        {
          id: CONVERSATION_ID,
          participant: { id: PARTICIPANT_ID, name: PARTICIPANT_NAME, initials: 'AB' },
          lastMessage: "Hi, I'd like to get stronger.",
          lastMessageAt: new Date().toISOString(),
          lastMessageIsOwn: false,
          unreadCount: 0,
          isFormer: false,
          isSendLocked: false,
          cooperation: {
            type: 'Request',
            direction: 'Received',
            status: state.status === 'Declined' ? 'Declined' : state.status === 'Accepted' ? 'Accepted' : 'Pending',
            sourceId: REQUEST_ID,
          },
        },
      ]),
  );
  await page.route(
    (url) => url.pathname === `/conversations/${CONVERSATION_ID}/messages`,
    (route) => json(route, { items: thread(state, sentAt) }),
  );
  await page.route(
    (url) => url.pathname === `/conversations/${CONVERSATION_ID}/read`,
    (route) => route.fulfill({ status: 204 }),
  );
  await page.route(
    (url) => url.pathname === '/trainer/client-requests',
    (route) =>
      json(route, {
        requests:
          state.status === 'Pending' || state.status === 'PackageProposed'
            ? [
                {
                  publicId: REQUEST_ID,
                  clientFirstName: 'Adam',
                  clientLastName: 'Bartos',
                  clientEmail: 'adam.bartos@example.test',
                  message: "Hi, I'd like to get stronger.",
                  sentAt: sentAt.toISOString(),
                  clientPublicId: PARTICIPANT_ID,
                  heightCm: 182,
                  weightKg: 88,
                  primaryGoal: 'BuildMuscle',
                  package: options.clientPackage,
                  shareHistory: options.shareHistory ?? false,
                  history: options.shareHistory ? { planCount: 3, measurementCount: 14, photoCount: 22 } : undefined,
                  status: state.status,
                  proposal:
                    state.status === 'PackageProposed'
                      ? {
                          proposedAt: new Date(sentAt.getTime() + 10 * MS_PER_MINUTE).toISOString(),
                          package: { publicId: LONG_TERM_ID, name: 'Long-term coaching', billing: 'EveryNWeeks', intervalWeeks: 5, price: 5000, currency: 'CZK' },
                        }
                      : undefined,
                },
              ]
            : [],
      }),
  );
  await page.route(
    (url) => url.pathname === '/trainer/clients/pending',
    (route) =>
      json(route, {
        rows: [
          {
            kind: 'Request',
            publicId: REQUEST_ID,
            firstName: 'Adam',
            lastName: 'Bartos',
            email: 'adam.bartos@example.test',
            message: "Hi, I'd like to get stronger.",
            sentAt: sentAt.toISOString(),
            status: 'Pending',
            package: options.clientPackage,
            shareHistory: false,
            proposal:
              state.status === 'PackageProposed'
                ? {
                    proposedAt: new Date(sentAt.getTime() + 10 * MS_PER_MINUTE).toISOString(),
                    package: { publicId: LONG_TERM_ID, name: 'Long-term coaching', billing: 'EveryNWeeks', intervalWeeks: 5, price: 5000, currency: 'CZK' },
                  }
                : undefined,
          },
          {
            kind: 'Invite',
            publicId: '99999999-0000-0000-0000-000000000699',
            email: 'klara.nemcova@example.test',
            sentAt: new Date(Date.now() - 3 * 24 * 60 * MS_PER_MINUTE).toISOString(),
            status: 'Pending',
            package: { publicId: LONG_TERM_ID, name: 'Kick-off consultation', billing: 'OneOff', price: 1200, currency: 'CZK' },
            shareHistory: false,
          },
          {
            kind: 'Invite',
            publicId: '99999999-0000-0000-0000-000000000698',
            email: 'petr.novotny@example.test',
            sentAt: new Date(Date.now() - 24 * 60 * MS_PER_MINUTE).toISOString(),
            status: 'Pending',
            shareHistory: false,
          },
        ],
      }),
  );
  await page.route((url) => url.pathname === '/payments/packages', (route) => json(route, { items: COACH_PACKAGES }));
  await page.route((url) => url.pathname === '/payments/discounts', (route) => json(route, { items: COACH_DISCOUNTS }));
  await page.route((url) => url.pathname === '/trainer/questionnaires', (route) => json(route, { questionnaires: FORMS }));

  await page.route(
    (url) => url.pathname === `/trainer/client-requests/${REQUEST_ID}/accept`,
    (route) => {
      state.acceptBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      const status = options.acceptStatus ?? 204;
      if (status === 204) {
        state.status = 'Accepted';
        return route.fulfill({ status: 204 });
      }
      state.status = 'Declined';
      return route.fulfill({
        status,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status, errorCode: options.acceptErrorCode ?? 'CLIENT_REQUEST_INVALID_STATE' }),
      });
    },
  );
  await page.route(
    (url) => url.pathname === `/trainer/client-requests/${REQUEST_ID}/propose-package`,
    (route) => {
      state.proposeBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      state.status = 'PackageProposed';
      state.proposalCardStatus = 'Pending';
      return route.fulfill({ status: 204 });
    },
  );
  await page.route(
    (url) => url.pathname === `/trainer/client-requests/${REQUEST_ID}/withdraw-proposal`,
    (route) => {
      state.withdrawCalls += 1;
      state.status = 'Pending';
      state.withdrawn = true;
      return route.fulfill({ status: 204 });
    },
  );
  return state;
}

async function openThread(page: Page): Promise<void> {
  await page.goto('/inbox');
  await page.getByRole('button').filter({ has: page.getByText(PARTICIPANT_NAME, { exact: true }) }).click();
}

test.describe('invite review drawer (#1906)', () => {
  test('a request with the client\'s package shows it on the card and accepts with a discount and a message', async ({ page }) => {
    const state = await stubRequestThread(page, { clientPackage: MONTHLY, shareHistory: true });
    await openThread(page);

    const card = page.getByTestId('client-request-card');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('client-request-card-package')).toContainText('Monthly coaching');
    // The board's "Client invite" eyebrow above the title is dropped.
    await expect(card.getByText('Client request')).toHaveCount(0);
    // Answering moved into the drawer: the card only opens it.
    await expect(card.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await card.getByRole('button', { name: 'View invite' }).click();

    const drawer = page.getByTestId('invite-review-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('offer-chosen-package')).toContainText('Monthly coaching');
    await expect(drawer.getByTestId('offer-chosen-package')).toContainText("Adam's choice");
    await expect(drawer.getByTestId('invite-review-history')).toHaveText('History shared · 3 plans · 14 measurements · 22 photos');
    // The client chose the package, so the coach cannot swap it.
    await expect(drawer.getByRole('radio', { name: /Long-term coaching/ })).toHaveCount(0);
    await expect(drawer.getByTestId('offer-form-row')).toContainText('Client Onboarding Form · 9 questions');

    await drawer.getByRole('button', { name: 'Add discount' }).click();
    // A fixed amount limited to another package is listed but disabled, with the reason.
    const student = drawer.getByRole('radio', { name: /Student/ });
    await expect(student).toBeDisabled();
    await expect(student).toContainText("Doesn't apply to this package");
    await drawer.getByRole('radio', { name: /Loyal client/ }).click();
    await expect(drawer.getByTestId('offer-discount-chip')).toContainText('Loyal client');
    // CZK groups with a no-break space, so match the digits across any whitespace.
    await expect(drawer.getByTestId('offer-payable')).toContainText(/1\s620/);

    await drawer.getByPlaceholder('Write a few words to Adam…').fill('Welcome');
    await expect(drawer.getByTestId('offer-message')).toContainText('7 / 500');
    await drawer.getByRole('button', { name: 'Accept', exact: true }).click();

    await expect(drawer).toHaveCount(0);
    expect(state.acceptBodies).toEqual([
      { questionnairePublicId: FORM_ID, statement: 'Welcome', discountPublicId: LOYAL_ID },
    ]);
    await expect(card).toHaveAttribute('data-status', 'Accepted');
  });

  test('a request with no package proposes one, then the proposal card can be withdrawn', async ({ page }) => {
    const state = await stubRequestThread(page);
    await openThread(page);

    await page.getByTestId('client-request-card').getByRole('button', { name: 'View invite' }).click();
    const drawer = page.getByTestId('invite-review-drawer');
    await expect(drawer.getByTestId('offer-package-tiles')).toBeVisible();
    // No history line when the client does not share their history.
    await expect(drawer.getByTestId('invite-review-history')).toHaveCount(0);
    await expect(drawer.getByTestId('invite-review-about')).toContainText("Hi, I'd like to get stronger.");

    await drawer.getByRole('radio', { name: /Long-term coaching/ }).click();
    await expect(drawer.getByTestId('offer-payable')).toContainText(/5\s000/);
    await drawer.getByRole('button', { name: 'Propose package' }).click();

    const proposal = page.getByTestId('proposal-sent-card');
    await expect(proposal).toBeVisible();
    await expect(proposal).toContainText('You proposed Long-term coaching');
    await expect(proposal).toContainText('Waiting for Adam to accept');
    expect(state.proposeBodies).toEqual([
      { packagePublicId: LONG_TERM_ID, discountPublicId: null, questionnairePublicId: FORM_ID, statement: null },
    ]);
    await expect(page.getByTestId('pending-client-panel').getByTestId('panel-status-chip')).toHaveText('Proposal sent');

    // A waiting proposal offers Withdraw in the drawer, never Accept or Propose.
    await proposal.getByRole('button', { name: 'View invite' }).click();
    const waitingDrawer = page.getByTestId('invite-review-drawer');
    await expect(waitingDrawer.getByTestId('invite-review-waiting')).toContainText('Long-term coaching');
    await expect(waitingDrawer.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
    await expect(waitingDrawer.getByRole('button', { name: 'Propose package' })).toHaveCount(0);
    // Only Withdraw is offered: the server refuses a decline once a proposal is out.
    await expect(waitingDrawer.getByRole('button', { name: 'Withdraw proposal' })).toBeVisible();
    await expect(waitingDrawer.getByRole('button', { name: 'Decline' })).toHaveCount(0);
    await waitingDrawer.getByRole('button', { name: 'Withdraw proposal' }).click();

    expect(state.withdrawCalls).toBe(1);
    // The withdrawal folds into the proposal card, not into the request card, which is Pending again.
    await expect(proposal).toHaveAttribute('data-status', 'Cancelled');
    await expect(proposal.getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('client-request-card')).toHaveAttribute('data-status', 'Pending');
    await expect(page.getByTestId('client-request-card').getByRole('button', { name: 'View invite' })).toBeVisible();
  });

  test('No package accepts the request without a package', async ({ page }) => {
    const state = await stubRequestThread(page);
    await openThread(page);

    await page.getByTestId('client-request-card').getByRole('button', { name: 'View invite' }).click();
    const drawer = page.getByTestId('invite-review-drawer');
    await expect(drawer.getByRole('button', { name: 'Propose package' })).toBeEnabled();
    await drawer.getByRole('radio', { name: /No package/ }).click();
    await expect(drawer.getByTestId('offer-payable')).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: 'Add discount' })).toHaveCount(0);
    await drawer.getByRole('button', { name: 'Accept without package' }).click();

    await expect(drawer).toHaveCount(0);
    expect(state.acceptBodies).toEqual([{ questionnairePublicId: FORM_ID, statement: null, discountPublicId: null }]);
    // An untouched form row sends the default form, never the skip flag.
    expect(state.acceptBodies[0]).not.toHaveProperty('skipOnboardingForm');
  });

  test('picking None for the onboarding form skips it explicitly instead of sending a form', async ({ page }) => {
    const state = await stubRequestThread(page, { clientPackage: MONTHLY });
    await openThread(page);

    await page.getByTestId('client-request-card').getByRole('button', { name: 'View invite' }).click();
    const drawer = page.getByTestId('invite-review-drawer');
    await drawer.getByTestId('offer-form-row').getByRole('button', { name: 'Change' }).click();
    await page.getByRole('option', { name: /^None/ }).click();
    await drawer.getByRole('button', { name: 'Accept', exact: true }).click();

    await expect(drawer).toHaveCount(0);
    expect(state.acceptBodies).toEqual([
      { questionnairePublicId: null, skipOnboardingForm: true, statement: null, discountPublicId: null },
    ]);
  });

  test('an accept refused because the request moved on shows a readable toast and closes the drawer', async ({ page }) => {
    await stubRequestThread(page, { clientPackage: MONTHLY, acceptStatus: 409, acceptErrorCode: 'CLIENT_REQUEST_INVALID_STATE' });
    await openThread(page);

    await page.getByTestId('client-request-card').getByRole('button', { name: 'View invite' }).click();
    const drawer = page.getByTestId('invite-review-drawer');
    await drawer.getByRole('button', { name: 'Accept', exact: true }).click();

    await expect(
      page.locator("[data-slot='toast']").filter({ hasText: 'This request was already answered or withdrawn.' }),
    ).toBeVisible();
    await expect(drawer).toHaveCount(0);
  });

  test('a message over 500 characters blocks the primary action', async ({ page }) => {
    await stubRequestThread(page, { clientPackage: MONTHLY });
    await openThread(page);

    await page.getByTestId('client-request-card').getByRole('button', { name: 'View invite' }).click();
    const drawer = page.getByTestId('invite-review-drawer');
    await drawer.getByPlaceholder('Write a few words to Adam…').fill('x'.repeat(501));
    await expect(drawer.getByTestId('offer-message')).toContainText('501 / 500');
    await expect(drawer.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
  });
});

test.describe('pending table (#1906)', () => {
  test('shows the package of requests and invites, a dash when there is none, and a proposal with Withdraw', async ({ page }) => {
    const state = await stubRequestThread(page, { clientPackage: MONTHLY });
    await page.goto('/clients?tab=Pending');

    const rows = page.getByRole('row');
    const requestRow = rows.filter({ hasText: 'Adam Bartos' });
    await expect(requestRow.getByTestId('pending-package-cell')).toHaveText('Monthly coaching');
    // Since #1923 an invite row carries its package too; an invite without one shows a dash.
    await expect(rows.filter({ hasText: 'klara.nemcova@example.test' }).getByTestId('pending-package-cell')).toHaveText(
      'Kick-off consultation',
    );
    await expect(rows.filter({ hasText: 'petr.novotny@example.test' }).getByTestId('pending-package-cell')).toHaveText('—');

    // Opening the review from the table shows the same drawer.
    await requestRow.getByRole('button', { name: 'View invite' }).click();
    await expect(page.getByTestId('invite-review-drawer')).toBeVisible();
    await page.keyboard.press('Escape');

    state.status = 'PackageProposed';
    await page.reload();
    const proposalRow = page.getByRole('row').filter({ hasText: 'Adam Bartos' });
    await expect(proposalRow.getByTestId('pending-package-cell')).toHaveText('Long-term coaching · proposed');
    await expect(proposalRow).toContainText('You proposed a package · waiting for Adam');
    await proposalRow.getByRole('button', { name: 'Withdraw' }).click();
    await expect.poll(() => state.withdrawCalls).toBe(1);
  });
});
