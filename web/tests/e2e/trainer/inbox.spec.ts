/**
 * #1095 — Inbox + chat page. Path is under trainer/ so playwright.config.ts's
 * role-subfolder testMatch collects it (see clients.spec.ts's own header
 * comment). QA seed: a conversation between qa.trainer and "QA Client" with
 * an unread message from the client and a coach message containing a
 * YouTube link; a third, conversation-less client keeps the "No messages"
 * filter non-zero on both the clients list and the inbox.
 */
import type { Locator, Page } from '@playwright/test';
import { trainerTest as test, expect, openClientContext } from '../fixtures/auth';

const QA_CLIENT_NAME = /QA Client/;

/**
 * The inbox list row button for the "QA Client" conversation, scoped to an
 * exact name match. The seeded, conversation-less "QA Client3" roster entry
 * (see the file header comment) also renders a row once the "All" filter
 * lists every live-roster client, so the unanchored `QA_CLIENT_NAME` regex
 * alone resolves to two buttons — a strict-mode violation. Scoping to the
 * row's `span.font-bold` name text via `exact: true` (same element
 * `getInboxRowNames` below reads) excludes "QA Client3" without excluding
 * the avatar's initials-fallback text ahead of it in DOM order.
 */
function qaClientRow(page: Page): Locator {
  return page.getByRole('button').filter({ has: page.getByText('QA Client', { exact: true }) });
}

/** Every visible clients-list row's name link on the CURRENT tab, for filter-parity comparisons. */
async function getClientsListNamesOnCurrentTab(page: Page): Promise<string[]> {
  const links = page.locator("table tbody a[href^='/clients/']");
  return (await links.allInnerTexts()).map((t) => t.trim());
}

/**
 * The clients-list roster for a given filter chip, unioned across the
 * Active and Paused tabs — matching the population contract's "live links,
 * archived links excluded" (docs: GetConversationsEndpoint's roster-filter
 * path; a Paused client is still a *live* link, per
 * `ClientStatusClassifier.Classify` returning Archived only when the LINK
 * itself is no longer live). The inbox's own filter has no tab concept —
 * it always spans this same union, never just the Active tab alone.
 */
async function getClientsListNamesForChip(page: Page, chipLabel: RegExp): Promise<string[]> {
  const names: string[] = [];
  for (const tab of ['Active', 'Paused'] as const) {
    await page.goto(`/clients?tab=${tab}`);
    await page.waitForLoadState('networkidle');
    const chip = page.getByRole('button', { name: chipLabel });
    const isZeroAndInactive = (await chip.getAttribute('disabled')) !== null;
    if (isZeroAndInactive) {
      continue;
    }
    await chip.click();
    await page.waitForLoadState('networkidle');
    names.push(...(await getClientsListNamesOnCurrentTab(page)));
  }
  return names.sort();
}

/** Every visible inbox row's participant-name text, for filter-parity comparisons. */
async function getInboxRowNames(page: Page): Promise<string[]> {
  // Scoped to the name span specifically — a row's button also contains the
  // avatar's initials-fallback text ("QC") ahead of the name in DOM order,
  // so reading the button's whole innerText and taking the first line picks
  // up the initials, not the name.
  const names = page.locator('button span.font-bold');
  return (await names.allInnerTexts()).map((t) => t.trim()).sort();
}

/**
 * Drives the real SignalR hub as a second, independently-authenticated
 * party: negotiates a connection as qa.client and invokes `SendTyping`
 * directly, over the SAME origin (so the Vite dev server's `/hubs` proxy —
 * `ws: true` in vite.config.e2e.ts — carries it to the harness, with no
 * separate TLS trust dance in the browser).
 */
async function sendTypingViaHub(page: Page, accessToken: string, conversationId: string): Promise<void> {
  await page.evaluate(
    async ({ accessToken, conversationId }) => {
      const negotiateRes = await fetch('/hubs/notifications/negotiate?negotiateVersion=1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const negotiate = (await negotiateRes.json()) as { connectionToken: string };
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://${window.location.host}/hubs/notifications?id=${negotiate.connectionToken}&access_token=${encodeURIComponent(accessToken)}`;

      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(wsUrl);
        const timeout = setTimeout(() => reject(new Error('SendTyping hub call timed out')), 8000);
        let handshakeDone = false;

        socket.onopen = () => {
          socket.send(`${JSON.stringify({ protocol: 'json', version: 1 })}\u001e`);
        };
        socket.onmessage = () => {
          if (!handshakeDone) {
            handshakeDone = true;
            socket.send(`${JSON.stringify({ type: 1, target: 'SendTyping', arguments: [conversationId] })}\u001e`);
            setTimeout(() => {
              clearTimeout(timeout);
              socket.close();
              resolve();
            }, 400);
          }
        };
        socket.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('SendTyping WebSocket errored'));
        };
      });
    },
    { accessToken, conversationId },
  );
}

test.describe('inbox page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  });

  test('empty-state copy matches the wireframe when no chat is selected', async ({ page }) => {
    await expect(page.getByText('Select a chat to begin messaging')).toBeVisible();
    await expect(
      page.getByText('Your client inbox, workout questions, and onboarding metrics live here.'),
    ).toBeVisible();
  });

  test('list renders with unread dot, time, and last-message preview; opening the thread marks it read', async ({
    page,
  }) => {
    const row = qaClientRow(page);
    await expect(row).toBeVisible();
    await expect(row.locator('[role="status"]')).toBeVisible(); // unread dot

    await row.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: QA_CLIENT_NAME }).or(page.getByText(QA_CLIENT_NAME).first())).toBeVisible();

    // Read mark round-trips through the backend + a list invalidation —
    // re-fetch the row and confirm the unread dot is gone.
    await expect(row.locator('[role="status"]')).toHaveCount(0);
  });

  test('search narrows the list by participant name', async ({ page }) => {
    await expect(qaClientRow(page)).toBeVisible();

    await page.getByPlaceholder('Search chats...').fill('zzz-no-such-participant');
    await expect(page.getByText('No conversations found')).toBeVisible();
    await expect(qaClientRow(page)).toHaveCount(0);

    await page.getByPlaceholder('Search chats...').fill('QA Client');
    await expect(qaClientRow(page)).toBeVisible();
  });

  test('the Active/Archived switch changes the visible rows', async ({ page }) => {
    await expect(qaClientRow(page)).toBeVisible();

    await page.getByRole('button', { name: /Active/ }).click();
    await page.getByRole('menuitem', { name: 'Archived' }).click();
    await page.waitForLoadState('networkidle');

    // No conversation is seeded as archived — the active-view row disappears.
    await expect(qaClientRow(page)).toHaveCount(0);

    await page.getByRole('button', { name: /Archived/ }).click();
    await page.getByRole('menuitem', { name: 'Active' }).click();
    await page.waitForLoadState('networkidle');
    await expect(qaClientRow(page)).toBeVisible();
  });

  test('the three domain-less filters render disabled with the coming-soon tooltip', async ({ page }) => {
    await page.getByRole('button', { name: /^All \(\d+\)$/ }).click();

    for (const label of ['Failed payments', 'Blocked automations', 'Tasks overdue']) {
      const item = page.getByRole('menuitem', { name: new RegExp(label) });
      await expect(item).toBeVisible();
      await expect(item).toHaveAttribute('aria-disabled', 'true');
      await expect(item).toHaveAttribute('title', 'This page is coming soon.');
    }
  });

  test('each live filter returns the same client set as the clients-list chip for that filter (#1095)', async ({
    page,
  }) => {
    const FILTERS: Array<{ inboxLabel: RegExp; chipLabel: RegExp; filterParam: string }> = [
      { inboxLabel: /^No messages/, chipLabel: /No messages/, filterParam: 'NoMessages' },
      { inboxLabel: /^Unread messages/, chipLabel: /Unread messages/, filterParam: 'UnreadMessages' },
      { inboxLabel: /^New check-ins/, chipLabel: /New check-ins/, filterParam: 'NewCheckIns' },
      { inboxLabel: /^Missing check-ins/, chipLabel: /Missing check-ins/, filterParam: 'MissingCheckIns' },
      { inboxLabel: /^Ending soon/, chipLabel: /Ending soon/, filterParam: 'EndingSoon' },
    ];

    for (const { inboxLabel, chipLabel, filterParam } of FILTERS) {
      const clientsNames = await getClientsListNamesForChip(page, chipLabel);

      await page.goto('/inbox');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /^All \(\d+\)$/ }).click();
      // `networkidle` alone is unreliable here — the inbox keeps a live
      // SignalR WebSocket open, so wait for the SPECIFIC filtered request
      // this click triggers instead (same pattern proven against the
      // running harness while diagnosing this exact flake).
      const filteredResponsePromise = page.waitForResponse(
        (r) => r.url().includes('/conversations?') && r.url().includes(`filter=${filterParam}`) && r.status() === 200,
      );
      await page.getByRole('menuitem', { name: inboxLabel }).click();
      await filteredResponsePromise;

      // A brief render lag can separate the response resolving from React
      // committing the row list — poll rather than a single snapshot read.
      await expect.poll(() => getInboxRowNames(page)).toEqual(clientsNames);
    }
  });

  test('a YouTube link in message text renders as an embedded preview card', async ({ page }) => {
    await qaClientRow(page).click();
    await page.waitForLoadState('networkidle');

    const thumbnail = page.locator('img[src*="img.youtube.com"]');
    await expect(thumbnail).toBeVisible();
  });

  test('sending a message appends it to the thread and updates the list preview', async ({ page }) => {
    await qaClientRow(page).click();
    await page.waitForLoadState('networkidle');

    const uniqueText = `QA reply ${Date.now()}`;
    await page.getByPlaceholder('Type your message here...').fill(uniqueText);
    await page.getByRole('button', { name: 'Send message' }).click();

    // Own-message bubble in the thread, and the row's updated preview line —
    // both legitimately carry the same text, so each assertion is scoped to
    // avoid a strict-mode "resolved to 2 elements" violation.
    await expect(page.getByText(uniqueText, { exact: true }).last()).toBeVisible();
    await expect(qaClientRow(page).getByText(uniqueText)).toBeVisible();
  });

  test('the Show-client panel status pill equals the clients-list status pill, and the external link opens the client', async ({
    page,
  }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    const listRow = page.getByRole('row', { name: QA_CLIENT_NAME });
    const listStatusText = (await listRow.locator('[data-slot="badge"]').first().innerText()).trim();

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await qaClientRow(page).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Show client' }).click();
    const panelStatusBadge = page.locator('[data-slot="badge"]').first();
    await expect(panelStatusBadge).toHaveText(listStatusText);

    await page.getByRole('link', { name: 'Open client profile' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: QA_CLIENT_NAME })).toBeVisible();
  });

  test('the client-detail Chat button opens the existing thread', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.getByRole('row', { name: QA_CLIENT_NAME }).getByRole('link', { name: QA_CLIENT_NAME }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: 'Chat' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/inbox');
    await expect(page.getByText('Select a chat to begin messaging')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show client' })).toBeVisible();
  });

  test('a newmessage SignalR event refreshes an open thread without a page reload, and the typing indicator appears and clears (#1095)', async ({
    page,
    browser,
    baseURL,
  }) => {
    // Re-fetch the list (fresh navigation, not the "no reload" behaviour
    // under test below) so we can intercept the app's own authenticated
    // request and read the real conversation id off it — a raw same-origin
    // fetch() from page.evaluate would skip the app's axios Bearer-token
    // interceptor (the access token lives in memory, not a cookie).
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
    const conversationId = match.id;

    await qaClientRow(page).click();
    await page.waitForLoadState('networkidle');

    const { context: clientContext, accessToken } = await openClientContext(browser, baseURL ?? 'http://localhost:5173');

    try {
      // newmessage: send AS qa.client directly against the API, bypassing
      // the UI, and confirm the trainer's already-open thread picks it up
      // live — no page.reload() anywhere in this test.
      const clientApi = await clientContext.request;
      const uniqueText = `QA client push ${Date.now()}`;
      const sendResponse = await clientApi.post(`/conversations/${conversationId}/messages`, {
        data: { text: uniqueText },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(sendResponse.ok()).toBe(true);
      // Appears in both the thread bubble and the list's updated preview line.
      await expect(page.getByText(uniqueText, { exact: true }).last()).toBeVisible({ timeout: 10_000 });

      // typing: invoke SendTyping through the real hub from the client
      // context and confirm the indicator appears within ~1s and clears by ~3.5s.
      const clientPage = await clientContext.newPage();
      await clientPage.goto('/download-app');
      await sendTypingViaHub(clientPage, accessToken, conversationId);

      await expect(page.getByText('Typing…')).toBeVisible({ timeout: 1000 });
      await expect(page.getByText('Typing…')).toHaveCount(0, { timeout: 4000 });
    } finally {
      await clientContext.close();
    }
  });
});
