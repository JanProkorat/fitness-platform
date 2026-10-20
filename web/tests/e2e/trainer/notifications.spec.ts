/**
 * Notifications popover, Inbox unread badge and the "Review in Clients" link.
 *
 * The notification list and the conversation counts are stubbed at the network
 * layer: the seeded fixture carries no coach notifications, and the shared
 * client2 request flow is owned by inbox-cooperation-events.spec.ts, so a
 * stub keeps this spec deterministic and independent of it. The live
 * SignalR -> Pending row path is an interactive-QA item.
 */
import type { Page } from '@playwright/test';
import { trainerTest as test, expect } from '../fixtures/auth';

interface StubNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

async function stubShellData(page: Page, unreadMessages: number) {
  const notifications: StubNotification[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      type: 'clientrequestreceived',
      title: 'Adam Bartos sent you a request',
      body: 'I would like to get stronger.',
      timestamp: new Date().toISOString(),
      read: false,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      type: 'invitationaccepted',
      title: 'Eva Svobodova accepted your invite',
      body: '',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      read: true,
    },
  ];

  await page.route('**/client/notifications?*', (route) =>
    route.fulfill({ json: { items: notifications, cursor: null } }),
  );
  await page.route('**/client/notifications/read-all', (route) => {
    notifications.forEach((n) => (n.read = true));
    return route.fulfill({ status: 204 });
  });
  await page.route('**/client/notifications/*/read', (route) => {
    const id = route.request().url().split('/').at(-2);
    const found = notifications.find((n) => n.id === id);
    if (found) found.read = true;
    return route.fulfill({ status: 204 });
  });
  await page.route('**/conversations/filter-counts', (route) =>
    route.fulfill({ json: { all: unreadMessages, unreadMessages } }),
  );
}

test.describe('notifications popover and inbox badge', () => {
  test('the bell opens the popover, shows the unread count and marks items read', async ({ page }) => {
    await stubShellData(page, 0);
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const bell = page.getByRole('navigation').getByRole('button', { name: /^Notifications/ });
    await expect(bell).toBeEnabled();
    await expect(page.getByTestId('notifications-badge')).toHaveText('1');

    await bell.click();
    const popover = page.getByRole('dialog', { name: 'Notifications' });
    await expect(popover).toBeVisible();
    await expect(popover.getByTestId('notification-item')).toHaveCount(2);
    await expect(popover.getByText('Adam Bartos sent you a request')).toBeVisible();

    await popover.getByRole('button', { name: 'Mark as read' }).click();
    await expect(page.getByTestId('notifications-badge')).toHaveCount(0);
    await expect(popover.locator('[data-unread="true"]')).toHaveCount(0);
  });

  test('mark all read clears every unread item', async ({ page }) => {
    await stubShellData(page, 0);
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('navigation').getByRole('button', { name: /^Notifications/ }).click();
    const popover = page.getByRole('dialog', { name: 'Notifications' });
    await popover.getByRole('button', { name: 'Mark all read' }).click();
    await expect(page.getByTestId('notifications-badge')).toHaveCount(0);
    await expect(popover.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
  });

  test('"Review in Clients" lands on the Pending tab', async ({ page }) => {
    await stubShellData(page, 0);
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    await page.getByRole('navigation').getByRole('button', { name: /^Notifications/ }).click();
    await page.getByRole('dialog', { name: 'Notifications' }).getByRole('button', { name: /Review in Clients/ }).click();

    await expect(page).toHaveURL(/\/clients\?tab=Pending/);
    await expect(page.getByRole('tab', { name: /^Pending/ })).toHaveAttribute('data-state', 'active');
  });

  test('the unread count sits on the Inbox nav item, not on Clients', async ({ page }) => {
    await stubShellData(page, 3);
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: /^Inbox/ }).getByTestId('sidebar-inbox-unread')).toHaveText('3');
    await expect(nav.getByRole('link', { name: /^Clients/ }).getByTestId('sidebar-inbox-unread')).toHaveCount(0);
    await expect(page.getByTestId('sidebar-unread-dot')).toHaveCount(0);
  });
});
