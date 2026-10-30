/**
 * Live refresh of the coach's bell when the hub pushes `offlinesyncconflict`.
 *
 * The real hub socket is passed through, and the event is injected as a SignalR JSON
 * invocation frame from the test, so no conflict or notification is written into the
 * shared fixture. The notifications endpoint is stubbed: empty until the frame is sent,
 * one unread conflict afterwards.
 */
import { nutritionistTest as test, expect } from '../fixtures/auth';

const RECORD_SEPARATOR = '\x1e';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const PLAN_ID = '55555555-5555-5555-5555-555555555555';

test('a pushed offlinesyncconflict event updates the bell without a reload', async ({ page }) => {
  let delivered = false;
  let handshakeSeen = false;
  let pushToPage: ((frame: string) => void) | null = null;

  await page.routeWebSocket(/\/hubs\/notifications/, (ws) => {
    const server = ws.connectToServer();
    // Observing server frames replaces the default forwarding, so forward by hand.
    server.onMessage((message) => {
      handshakeSeen = true;
      ws.send(message);
    });
    ws.onMessage((message) => server.send(message));
    pushToPage = (frame) => ws.send(frame);
  });

  await page.route('**/client/notifications?*', (route) =>
    route.fulfill({
      json: {
        items: delivered
          ? [
              {
                id: '44444444-4444-4444-4444-444444444444',
                type: 'offlinesyncconflict',
                title: 'Offline entry conflicts with your plan',
                body: 'Jana Novakova logged a meal on an older version of Cut.',
                timestamp: new Date().toISOString(),
                read: false,
                actionPayload: JSON.stringify({
                  clientName: 'Jana Novakova',
                  planName: 'Cut',
                  count: 1,
                  clientPublicId: CLIENT_ID,
                }),
              },
            ]
          : [],
        cursor: null,
      },
    }),
  );

  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('notifications-badge')).toHaveCount(0);
  // The first server frame is the handshake reply; invocations are only valid after it.
  await expect.poll(() => handshakeSeen).toBe(true);

  await page.evaluate(() => {
    (window as unknown as { __liveMarker: string }).__liveMarker = 'still-here';
  });

  delivered = true;
  const frame = {
    type: 1,
    target: 'offlinesyncconflict',
    arguments: [{ clientId: CLIENT_ID, planId: PLAN_ID, count: 1 }],
  };
  expect(pushToPage).not.toBeNull();
  (pushToPage as unknown as (frame: string) => void)(JSON.stringify(frame) + RECORD_SEPARATOR);

  await expect(page.getByTestId('notifications-badge')).toHaveText('1');

  await page.getByRole('navigation').getByRole('button', { name: /^Notifications/ }).click();
  const item = page.getByRole('dialog', { name: 'Notifications' }).getByTestId('notification-item');
  await expect(item).toContainText('Offline entry conflicts with your plan');

  expect(await page.evaluate(() => (window as unknown as { __liveMarker?: string }).__liveMarker)).toBe('still-here');
});
