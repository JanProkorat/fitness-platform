/**
 * Offline-sync conflicts on the coach side: the Recent activity card rows and the
 * bell notification with its "See in client activity" link.
 *
 * The fixture has no conflict data, so the conflicts endpoint, the timeline and the
 * notification list are stubbed at the network layer. The live `offlinesyncconflict`
 * SignalR refresh is an interactive-QA item.
 */
import type { Page, Route } from '@playwright/test';
import { nutritionistTest, trainerTest, expect } from '../fixtures/auth';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const logDate = (msAgo: number) => iso(msAgo).slice(0, 10);

const CONFLICTS_URL = '**/trainer/clients/*/offline-sync-conflicts*';
const CLIENT_PUBLIC_ID = '33333333-3333-3333-3333-333333333333';

/** Stubs the conflicts list for GET only, so the review POSTs are never swallowed. */
async function stubConflicts(page: Page, respond: (route: Route) => Promise<void>) {
  await page.route(CONFLICTS_URL, (route, request) =>
    request.method() === 'GET' ? respond(route) : route.fallback(),
  );
}

async function stubTimeline(page: Page) {
  await page.route('**/trainer/clients/*/timeline*', (route) =>
    route.fulfill({
      json: {
        canViewNutritionPlans: true,
        canViewTrainingPlans: false,
        items: [
          {
            id: 'timeline-measurement',
            type: 'measurement',
            occurredAt: iso(HOUR_MS),
            title: 'Measurement',
            measurement: { weightKg: 72.4, bodyFatPercentage: 27 },
          },
          {
            id: 'timeline-plan',
            type: 'nutrition_plan_published',
            occurredAt: iso(10 * DAY_MS),
            title: 'Plan',
            planPublished: { planId: 'p1', planName: 'Cut', weekNumber: 7 },
          },
        ],
      },
    }),
  );
}

async function openFirstClient(page: Page) {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  await page.getByRole('row').filter({ has: page.getByRole('link', { name: 'QA Client', exact: true }) })
    .getByRole('link', { name: 'QA Client', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Recent activity', exact: true })).toBeVisible();
}

nutritionistTest.describe('offline-sync conflicts in Recent activity', () => {
  nutritionistTest('shows both conflict kinds and ranks a late-synced one by detection time', async ({ page }) => {
    await stubTimeline(page);
    await stubConflicts(page, (route) =>
      route.fulfill({
        json: {
          items: [
            {
              // Eaten five days ago, synced half an hour ago: ranks above the 1 h old measurement.
              conflictId: 'c-late',
              planId: 'p1',
              planName: 'Cut',
              operation: 'LogMealEaten',
              kind: 'PlanChanged',
              mealId: 'm1',
              mealKind: 'Lunch',
              mealLogged: true,
              occurredAt: iso(5 * DAY_MS),
              logDate: logDate(5 * DAY_MS),
              basedOnPlanVersion: 4,
              currentPlanVersion: 6,
              detectedAt: iso(30 * MINUTE_MS),
            },
            {
              conflictId: 'c-removed',
              planId: 'p1',
              planName: 'Cut',
              operation: 'LogMealEaten',
              kind: 'MealRemoved',
              mealId: 'm2',
              mealKind: 'AfternoonSnack',
              mealLogged: false,
              occurredAt: iso(3 * HOUR_MS),
              logDate: logDate(3 * HOUR_MS),
              basedOnPlanVersion: 4,
              currentPlanVersion: 6,
              detectedAt: iso(2 * HOUR_MS),
              // Reviewed: it keeps its chronological place instead of pinning to the top.
              reviewedAt: iso(HOUR_MS),
            },
          ],
        },
      }),
    );

    await openFirstClient(page);

    const rows = page.getByTestId('activity-conflict');
    await expect(rows).toHaveCount(2);

    const planChanged = page.locator('[data-testid="activity-conflict"][data-kind="PlanChanged"]');
    await expect(planChanged).toContainText('Logged offline on an older plan');
    await expect(planChanged).toContainText('Lunch');
    await expect(planChanged).toContainText('plan version 4');
    await expect(planChanged).toContainText('version 6');

    const removed = page.locator('[data-testid="activity-conflict"][data-kind="MealRemoved"]');
    await expect(removed).toContainText('Eaten offline, meal since removed');
    await expect(removed).toContainText('Not added to the meal log');

    // Order of the whole card: late conflict, measurement (1 h), removed-meal conflict (2 h), plan.
    const card = page.getByRole('heading', { name: 'Recent activity', exact: true }).locator('xpath=../..');
    const items = card.locator('li');
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toContainText('Logged offline on an older plan');
    await expect(items.nth(1)).toContainText('Measurement');
    await expect(items.nth(2)).toContainText('Eaten offline, meal since removed');
    await expect(items.nth(3)).toContainText('Meal plan published');

    // The right-hand time is the detection time, so the list reads in order.
    await expect(items.nth(0).getByTestId('activity-conflict-time')).toHaveText('30 minutes ago');
    await expect(items.nth(1)).toContainText('1 hour ago');
    await expect(items.nth(2).getByTestId('activity-conflict-time')).toHaveText('2 hours ago');
  });

  nutritionistTest('pins an unreviewed conflict above newer timeline rows and leaves reviewed ones in place', async ({ page }) => {
    await stubTimeline(page);
    const conflict = {
      planId: 'p1',
      planName: 'Cut',
      operation: 'LogMealEaten',
      kind: 'PlanChanged',
      mealKind: 'Lunch',
      mealLogged: true,
      basedOnPlanVersion: 4,
      currentPlanVersion: 6,
    };
    await stubConflicts(page, (route) =>
      route.fulfill({
        json: {
          items: [
            // Detected 5 h ago (older than the 1 h measurement) but unreviewed: pinned first.
            { ...conflict, conflictId: 'c-open', occurredAt: iso(6 * HOUR_MS), logDate: logDate(6 * HOUR_MS), detectedAt: iso(5 * HOUR_MS) },
            // Reviewed: ranks by detection time like any row, so 30 min sits above the 1 h measurement.
            {
              ...conflict,
              conflictId: 'c-done',
              kind: 'MealRemoved',
              mealKind: 'AfternoonSnack',
              occurredAt: iso(HOUR_MS),
              logDate: logDate(HOUR_MS),
              detectedAt: iso(30 * MINUTE_MS),
              reviewedAt: iso(10 * MINUTE_MS),
            },
          ],
        },
      }),
    );

    await openFirstClient(page);

    const card = page.getByRole('heading', { name: 'Recent activity', exact: true }).locator('xpath=../..');
    const items = card.locator('li');
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toHaveAttribute('data-reviewed', 'false');
    await expect(items.nth(0)).toContainText('Logged offline on an older plan');
    await expect(items.nth(1)).toHaveAttribute('data-reviewed', 'true');
    await expect(items.nth(1)).toContainText('Eaten offline, meal since removed');
    await expect(items.nth(2)).toContainText('Measurement');
  });

  nutritionistTest('a failing conflicts endpoint keeps the timeline rows', async ({ page }) => {
    await stubTimeline(page);
    await stubConflicts(page, (route) => route.fulfill({ status: 500, json: { title: 'boom' } }));

    await openFirstClient(page);

    await expect(page.getByText('Measurement', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('activity-conflict')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  });

  nutritionistTest('a 403 from the conflicts endpoint reads as an empty list', async ({ page }) => {
    await stubTimeline(page);
    await stubConflicts(page, (route) => route.fulfill({ status: 403, json: { title: 'forbidden' } }));

    await openFirstClient(page);

    await expect(page.getByText('Measurement', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('activity-conflict')).toHaveCount(0);
  });
});

nutritionistTest.describe('offline-sync conflict notification in the bell', () => {
  async function stubNotifications(page: Page, actionPayload: string | null) {
    const notification = {
      id: '44444444-4444-4444-4444-444444444444',
      type: 'offlinesyncconflict',
      title: 'Offline entry conflicts with your plan',
      body: 'Jana Novakova logged a meal on an older version of Cut.',
      timestamp: new Date().toISOString(),
      read: false,
      actionPayload,
    };
    let markedRead = false;
    await page.route('**/client/notifications?*', (route) =>
      route.fulfill({ json: { items: [{ ...notification, read: markedRead }], cursor: null } }),
    );
    await page.route('**/client/notifications/*/read', (route) => {
      markedRead = true;
      return route.fulfill({ status: 204 });
    });
    await page.route('**/conversations/filter-counts', (route) => route.fulfill({ json: { all: 0, unreadMessages: 0 } }));
  }

  nutritionistTest('shows initials, the server copy and a link to the client that marks it read', async ({ page }) => {
    await stubNotifications(
      page,
      JSON.stringify({ clientName: 'Jana Novakova', planName: 'Cut', count: 1, clientPublicId: CLIENT_PUBLIC_ID }),
    );
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('navigation').getByRole('button', { name: /^Notifications/ }).click();
    const popover = page.getByRole('dialog', { name: 'Notifications' });
    const item = popover.getByTestId('notification-item');

    await expect(item.getByTestId('notification-conflict-avatar')).toContainText('JN');
    await expect(item).toContainText('Offline entry conflicts with your plan');
    await expect(item).toContainText('Jana Novakova logged a meal on an older version of Cut.');

    const readRequest = page.waitForRequest((request) => /\/client\/notifications\/.+\/read$/.test(request.url()));
    await item.getByRole('button', { name: /See in client activity/ }).click();
    await readRequest;

    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_PUBLIC_ID}$`));
  });

  nutritionistTest('renders without a link when the payload is not usable', async ({ page }) => {
    await stubNotifications(page, 'not json');
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    await page.getByRole('navigation').getByRole('button', { name: /^Notifications/ }).click();
    const item = page.getByRole('dialog', { name: 'Notifications' }).getByTestId('notification-item');
    await expect(item).toContainText('Offline entry conflicts with your plan');
    await expect(item.getByRole('button', { name: /See in client activity/ })).toHaveCount(0);
  });
});

trainerTest.describe('trainer-only viewer', () => {
  trainerTest('never calls the conflicts endpoint', async ({ page }) => {
    const conflictRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/offline-sync-conflicts')) conflictRequests.push(request.url());
    });

    await openFirstClient(page);
    await page.waitForLoadState('networkidle');

    expect(conflictRequests).toEqual([]);
    await expect(page.getByTestId('activity-conflict')).toHaveCount(0);
  });
});
