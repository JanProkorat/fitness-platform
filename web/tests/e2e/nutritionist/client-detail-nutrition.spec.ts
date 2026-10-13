/**
 * Client detail Nutrition tab for a nutritionist-only link (the QA nutritionist
 * and the seeded QA Client, who has one Active plan and no past plans).
 *
 * The seed has no client without a nutrition plan, no Completed plan and no plan
 * templates, so those states are produced by rewriting the plans list and the
 * template search through `page.route`; the actions that would write (instantiate,
 * save as template) are answered by a stub too, and their request bodies are
 * asserted. The populated tab is checked against the real seeded plan.
 * Run against a freshly reset harness.
 */
import type { Page, Route } from '@playwright/test';
import { nutritionistTest as test, expect } from '../fixtures/auth';

const DAY_MS = 24 * 60 * 60 * 1000;
const STUB_DRAFT_PLAN_ID = '00000000-0000-0000-1329-000000000001';
const STUB_COMPLETED_PLAN_ID = '00000000-0000-0000-1329-000000000002';

interface PlanListBody {
  plans: Record<string, unknown>[];
  canViewNutritionPlans: boolean;
  canViewTrainingPlans: boolean;
}

function isoDaysFromNow(days: number): string {
  const date = new Date(Date.now() + days * DAY_MS);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function openClientDetail(page: Page): Promise<void> {
  await page.goto('/clients');
  await page.waitForLoadState('networkidle');
  const row = page.getByRole('row', { name: /QA Client/ });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: /QA Client/ }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /QA Client/ })).toBeVisible();
}

async function openNutritionTab(page: Page): Promise<void> {
  await openClientDetail(page);
  await page.getByRole('tab', { name: 'Nutrition' }).click();
  await expect(page).toHaveURL(/\/clients\/[^/]+\/nutrition$/);
}

/** Rewrites the real plans list response with `transform`. */
async function rewritePlansList(page: Page, transform: (body: PlanListBody) => PlanListBody): Promise<void> {
  await page.route(/\/trainer\/clients\/[^/]+\/plans$/, async (route: Route) => {
    const response = await route.fetch();
    const body = (await response.json()) as PlanListBody;
    await route.fulfill({ response, json: transform(body) });
  });
}

test.describe('client detail — nutrition tab', () => {
  test('is URL-driven and shows the current plan, timeline and past plans', async ({ page }) => {
    await openNutritionTab(page);

    await expect(page.getByRole('tab', { name: 'Nutrition' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');

    // Current plan: the seeded two-week plan, week 2 in progress, a disabled editor button.
    await expect(page.getByText('Current meal plan', { exact: true })).toBeVisible();
    const strip = page.getByRole('list', { name: /Weeks of the plan/ });
    await expect(strip.getByRole('listitem')).toHaveCount(2);
    await expect(strip.locator('[data-state="done"]')).toHaveCount(1);
    await expect(strip.locator('[data-state="current"]')).toHaveCount(1);
    const currentCard = page.locator('section', { has: page.getByText('Current meal plan', { exact: true }) });
    for (const legend of ['Done', 'This week', 'Published, upcoming']) {
      await expect(currentCard.getByText(legend, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Open editor' })).toBeDisabled();
    await expect(page.getByText('Preview as client')).toHaveCount(0);
    await expect(page.getByText(/2,500 kcal a day/)).toBeVisible();

    // Timeline: the plan is a disabled bar and today is marked.
    await expect(page.getByRole('heading', { name: 'Plan timeline' })).toBeVisible();
    await expect(page.getByTestId('plan-timeline-row').getByRole('button').first()).toBeDisabled();
    await expect(page.getByText('Today', { exact: true })).toBeVisible();

    // Past plans: none yet for this client.
    await expect(page.getByRole('heading', { name: 'Past plans' })).toBeVisible();
    await expect(page.getByText('none yet')).toBeVisible();

    // The tab survives a reload, and Back returns to Overview.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('tab', { name: 'Nutrition' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Current meal plan', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page).toHaveURL(/\/clients\/[^/]+$/);
    await expect(page.getByRole('region', { name: 'Current meal plan' })).toBeVisible();
  });

  test('lists a completed plan, leaves a gap on the timeline and saves it as a template', async ({ page }) => {
    await rewritePlansList(page, (body) => ({
      ...body,
      plans: [
        ...body.plans,
        {
          planId: STUB_COMPLETED_PLAN_ID,
          planType: 'Nutrition',
          name: 'Stub cut — summer',
          periodStart: isoDaysFromNow(-100),
          periodEnd: isoDaysFromNow(-50),
          status: 'Completed',
          resultSummary: { compliancePercent: 82, weightDeltaKg: -3.4 },
        },
      ],
    }));

    let savedBody: Record<string, unknown> | undefined;
    await page.route(/\/nutrition\/plan-templates\/from-plan$/, async (route) => {
      savedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ templateId: '00000000-0000-0000-1329-0000000000aa', name: savedBody['name'] }),
      });
    });

    await openNutritionTab(page);

    const past = page.getByRole('region', { name: 'Past plans' });
    await expect(past.getByText('Stub cut — summer')).toBeVisible();
    await expect(past.getByText('82 %')).toBeVisible();
    await expect(past.getByText(/-3\.4 kg/)).toBeVisible();
    await expect(page.getByText('No plan', { exact: true })).toBeVisible();

    // Opening and duplicating are disabled; saving as a template is live.
    await past.getByRole('button', { name: /Actions for Stub cut/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Open plan' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('menuitem', { name: /Duplicate for/ })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('menuitem', { name: 'Save as template' }).click();

    const dialog = page.getByRole('dialog', { name: 'Save as template' });
    const nameInput = dialog.getByLabel('Template name');
    await expect(nameInput).toHaveValue('Stub cut — summer');

    // An empty name is blocked client-side.
    await nameInput.fill('');
    await dialog.getByRole('button', { name: 'Save template' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    expect(savedBody).toBeUndefined();

    await nameInput.fill('Summer cut template');
    await dialog.getByRole('button', { name: 'Save template' }).click();
    await expect(page.getByText('Template saved to your library.', { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(savedBody).toMatchObject({
      planId: STUB_COMPLETED_PLAN_ID,
      name: 'Summer cut template',
      visibility: 'Private',
    });
  });

  test('shows the empty state with matched templates and starts a draft from one', async ({ page }) => {
    let draftCreated = false;
    await rewritePlansList(page, (body) => ({
      ...body,
      plans: draftCreated
        ? [
            {
              planId: STUB_DRAFT_PLAN_ID,
              planType: 'Nutrition',
              name: 'Vegetarian cut',
              status: 'Draft',
            },
          ]
        : [],
    }));

    const template = (id: string, name: string, extra: Record<string, unknown>) => ({
      templateId: id,
      name,
      weekCount: 4,
      usedBy: 0,
      visibility: 'Private',
      isOwnedByCurrentUser: true,
      version: 1,
      dateCreated: '2026-01-01T00:00:00Z',
      ...extra,
    });
    await page.route(/\/nutrition\/plan-templates(\?.*)?$/, async (route) => {
      await route.fulfill({
        json: {
          templates: [
            template('00000000-0000-0000-1329-0000000000b1', 'Maintenance — 4 weeks', { goal: 'Maintain', avgKcalPerDay: 2600 }),
            template('00000000-0000-0000-1329-0000000000b2', 'Lean cut — 12 weeks', {
              goal: 'LoseFat',
              dietaryStyle: 'Standard',
              weekCount: 12,
              avgKcalPerDay: 2200,
              description: 'Moderate deficit, high protein',
            }),
            template('00000000-0000-0000-1329-0000000000b3', 'Vegetarian cut', {
              goal: 'LoseFat',
              dietaryStyle: 'Vegetarian',
              weekCount: 6,
              avgKcalPerDay: 1950,
            }),
          ],
          totalCount: 3,
          page: 1,
          pageSize: 50,
        },
      });
    });
    await page.route(new RegExp(`/nutrition/plans/${STUB_DRAFT_PLAN_ID}$`), async (route) => {
      await route.fulfill({
        json: {
          planId: STUB_DRAFT_PLAN_ID,
          clientId: '11111111-1111-1111-1111-111111111111',
          nutritionistId: '33333333-3333-3333-3333-333333333333',
          name: 'Vegetarian cut',
          status: 'Draft',
          globalSettings: { dailyKcal: 1950 },
          weeks: [1, 2, 3, 4, 5, 6].map((weekNumber) => ({ weekNumber, status: 'Draft', days: [] })),
          version: 1,
          dateCreated: '2026-10-01T00:00:00Z',
          startDate: null,
          mealLogs: [],
          supplements: [],
        },
      });
    });

    const instantiateRequests: Record<string, unknown>[] = [];
    let attempts = 0;
    await page.route(/\/nutrition\/plan-templates\/[^/]+\/instantiate$/, async (route) => {
      instantiateRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          body: JSON.stringify({ status: 409, errorCode: 'PLAN_OVERLAP' }),
        });
        return;
      }
      draftCreated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ planId: STUB_DRAFT_PLAN_ID, name: 'Vegetarian cut', status: 'Draft' }),
      });
    });

    await openNutritionTab(page);

    await expect(page.getByRole('heading', { name: /has no meal plan yet/ })).toBeVisible();
    await expect(page.getByText('Preview as client')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy from another client' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Start blank' })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Browse all templates' })).toHaveAttribute('href', '/plan-templates');

    // Three templates, the goal + kcal + diet match first and flagged as the best match.
    const cards = page.getByRole('radio');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('Lean cut — 12 weeks');
    await expect(cards.first()).toContainText('Best match');
    await expect(cards.first()).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Use “Lean cut — 12 weeks”' })).toBeVisible();

    // Choosing another card retargets the primary action.
    await cards.nth(1).click();
    await expect(cards.nth(1)).toHaveAttribute('aria-checked', 'true');
    const useButton = page.getByRole('button', { name: /^Use “/ });
    await expect(useButton).toContainText(await cards.nth(1).locator('span.font-bold').first().innerText());

    // 409 PLAN_OVERLAP: an error toast, the empty state stays.
    await useButton.click();
    await expect(page.getByText('The selected date range overlaps an existing plan for this client.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /has no meal plan yet/ })).toBeVisible();

    // Second attempt succeeds: the tab refetches and shows the new, unscheduled Draft.
    await useButton.click();
    await expect(page.getByRole('heading', { name: 'Vegetarian cut' })).toBeVisible();
    await expect(page.getByText('Not scheduled')).toBeVisible();
    await expect(page.getByRole('list', { name: /Weeks of the plan/ }).locator('[data-state="draft"]')).toHaveCount(6);
    await expect(page.getByRole('heading', { name: /has no meal plan yet/ })).toHaveCount(0);

    // Both attempts sent the template's name and a future Monday as the start date.
    expect(instantiateRequests).toHaveLength(2);
    for (const body of instantiateRequests) {
      expect(body['name']).toBe('Vegetarian cut');
      expect(String(body['clientId'])).toMatch(/^[0-9a-f-]{36}$/);
      const startDate = String(body['startDate']);
      expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const start = new Date(`${startDate}T00:00:00`);
      expect(start.getDay()).toBe(1);
      expect(start.getTime()).toBeGreaterThan(Date.now());
    }
  });

  test.describe('this week card', () => {
    const WEEK_PLAN_ID = '00000000-0000-0000-1333-000000000001';
    const WEEK_PLAN_NAME = 'Stub week plan';

    function localIso(date: Date): string {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    }

    /** This week's Monday, local midnight. */
    function thisMonday(): Date {
      const now = new Date();
      const daysSinceMonday = (now.getDay() + 6) % 7;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    }

    function meal(
      id: string,
      kind: string,
      order: number,
      macros: { kcal: number; protein: number; carbs: number; fat: number } | null,
    ) {
      return {
        mealId: id,
        kind,
        order,
        foods: macros
          ? []
          : [
              {
                foodExternalId: 'stub-food',
                foodName: 'Stub food',
                nutrientValuePer100Grams: { kcal: 200, protein: 10, carbs: 20, fat: 5 },
                amountGrams: 100,
              },
            ],
        recipes: [],
        mealTotals: macros ? { ...macros, fiber: 0 } : null,
      };
    }

    /** Four meals a day; Monday's snack has no stored totals so the foods fallback is used. */
    function dayMeals(prefix: string, snackTotals: boolean) {
      return [
        meal(`${prefix}-b`, 'Breakfast', 1, { kcal: 500, protein: 30, carbs: 50, fat: 15 }),
        meal(`${prefix}-s`, 'MorningSnack', 2, snackTotals ? { kcal: 200, protein: 10, carbs: 20, fat: 5 } : null),
        meal(`${prefix}-l`, 'Lunch', 3, { kcal: 700, protein: 50, carbs: 70, fat: 20 }),
        meal(`${prefix}-d`, 'Dinner', 4, { kcal: 600, protein: 40, carbs: 60, fat: 25 }),
      ];
    }

    /** Week 1 starting this Monday; the test pins "now" to Thursday noon so Mon-Wed are finished. */
    function buildPlan(startDate: string, monday: Date) {
      const dayIso = (offset: number) => localIso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset));
      const eaten = (id: string, offset: number) => ({
        mealId: id,
        logDate: dayIso(offset),
        isEaten: true,
        eatenAt: `${dayIso(offset)}T12:00:00Z`,
      });
      return {
        planId: WEEK_PLAN_ID,
        clientId: '11111111-1111-1111-1111-111111111111',
        nutritionistId: '33333333-3333-3333-3333-333333333333',
        name: WEEK_PLAN_NAME,
        status: 'Active',
        globalSettings: { dailyKcal: 2000, proteinGrams: 150, carbsGrams: 200, fatGrams: 60 },
        weeks: [
          {
            weekNumber: 1,
            status: 'Published',
            days: [
              { dayOfWeek: 1, meals: dayMeals('mon', false) },
              { dayOfWeek: 2, meals: dayMeals('tue', true) },
              { dayOfWeek: 3, meals: dayMeals('wed', true) },
              { dayOfWeek: 4, meals: dayMeals('thu', true) },
            ],
          },
        ],
        version: 1,
        dateCreated: '2026-01-01T00:00:00Z',
        startDate,
        mealLogs: [
          // Monday: everything eaten.
          eaten('mon-b', 0),
          eaten('mon-s', 0),
          eaten('mon-l', 0),
          eaten('mon-d', 0),
          // Tuesday: dinner only has a photo stub, which does not count.
          eaten('tue-b', 1),
          eaten('tue-s', 1),
          eaten('tue-l', 1),
          { mealId: 'tue-d', logDate: dayIso(1), isEaten: false, eatenAt: null },
          // Wednesday: breakfast only, a low day.
          eaten('wed-b', 2),
          // Today is excluded from the numbers.
          eaten('thu-b', 3),
          // A log on the right meal but another date does not count.
          { mealId: 'wed-l', logDate: dayIso(-7), isEaten: true, eatenAt: null },
        ],
        supplements: [],
      };
    }

    /** The app's query client retries a failed query once, so a failure has to last until the test lets it recover. */
    async function stubPlan(
      page: Page,
      startDate: string,
      monday: Date,
      control: { failing: boolean } = { failing: false },
    ): Promise<void> {
      await rewritePlansList(page, (body) => ({
        ...body,
        plans: [
          {
            planId: WEEK_PLAN_ID,
            planType: 'Nutrition',
            name: WEEK_PLAN_NAME,
            periodStart: startDate,
            status: 'Active',
          },
        ],
      }));
      await page.route(new RegExp(`/nutrition/plans/${WEEK_PLAN_ID}$`), async (route) => {
        if (control.failing) {
          await route.fulfill({ status: 500, contentType: 'application/problem+json', body: '{"status":500}' });
          return;
        }
        await route.fulfill({ json: buildPlan(startDate, monday) });
      });
    }

    /** Pins "now" to this week's Thursday noon. */
    async function pinThursday(page: Page, monday: Date): Promise<void> {
      await page.clock.setFixedTime(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3, 12, 0, 0));
    }

    test('computes the week from the plan, excluding today', async ({ page }) => {
      const monday = thisMonday();
      await pinThursday(page, monday);
      await stubPlan(page, localIso(monday), monday);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'This week' });
      await expect(card).toBeVisible();
      await expect(card.getByText('Week 1 · Mon – Wed logged')).toBeVisible();

      // 12 planned meals on Mon-Wed, 8 eaten (a stub log, another date and today do not count).
      await expect(card.getByTestId('this-week-eaten')).toHaveText('8');
      await expect(card).toContainText('of 12 meals');
      await expect(card).toContainText('ticked off · 67 %');

      const tiles = card.getByRole('list', { name: 'Meals ticked off per day' }).getByRole('listitem');
      await expect(tiles).toHaveCount(7);
      const expected: [string, string, string | null][] = [
        ['past', 'false', '4/4'],
        ['past', 'false', '3/4'],
        ['past', 'true', '1/4'],
        ['today', 'false', 'today'],
        ['future', 'false', null],
        ['future', 'false', null],
        ['future', 'false', null],
      ];
      for (const [index, [state, low, label]] of expected.entries()) {
        const tile = tiles.nth(index);
        await expect(tile).toHaveAttribute('data-state', state);
        await expect(tile).toHaveAttribute('data-low', low);
        if (label) {
          await expect(tile).toContainText(label);
        } else {
          // A future tile is empty and is not mistaken for today.
          await expect(tile).not.toContainText('today');
          await expect(tile).not.toContainText('/');
        }
      }

      // By meal: Snack groups the snack. Skipped 0 says "always", skipped 1 has no note,
      // skipped 2 or more is flagged red with the note.
      const row = (group: string) => card.locator(`[data-group="${group}"]`);
      await expect(row('breakfast')).toContainText('3/3');
      await expect(row('breakfast')).toContainText('always');
      await expect(row('breakfast')).toHaveAttribute('data-flagged', 'false');
      for (const group of ['snack', 'lunch']) {
        await expect(row(group)).toContainText('2/3');
        await expect(row(group)).toHaveAttribute('data-flagged', 'false');
        await expect(row(group)).not.toContainText('skipped');
        await expect(row(group)).not.toContainText('always');
      }
      await expect(row('dinner')).toContainText('1/3');
      await expect(row('dinner')).toHaveAttribute('data-flagged', 'true');
      await expect(row('dinner')).toContainText('skipped 2× this week');

      // Daily averages over the three finished days against the plan targets.
      await expect(card.locator('[data-macro="kcal"]')).toContainText('1,300');
      await expect(card.locator('[data-macro="kcal"]')).toContainText('/ 2,000');
      await expect(card.locator('[data-macro="protein"]')).toContainText('83');
      await expect(card.locator('[data-macro="protein"]')).toContainText('/ 150 g');
      await expect(card.locator('[data-macro="carbs"]')).toContainText('130');
      await expect(card.locator('[data-macro="fat"]')).toContainText('40');
    });

    test('shows a retry when the plan fails to load and recovers', async ({ page }) => {
      const monday = thisMonday();
      await pinThursday(page, monday);
      const control = { failing: true };
      await stubPlan(page, localIso(monday), monday, control);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'This week' });
      await expect(card.getByText("Couldn't load this week's meals.")).toBeVisible();
      control.failing = false;
      await card.getByRole('button', { name: 'Retry' }).click();
      await expect(card.getByTestId('this-week-eaten')).toHaveText('8');
    });

    test('says why there is nothing to track before the plan starts', async ({ page }) => {
      const monday = thisMonday();
      await pinThursday(page, monday);
      const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
      await stubPlan(page, localIso(nextMonday), monday);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'This week' });
      await expect(card).toBeVisible();
      await expect(card.getByRole('status')).toContainText('The plan starts');
      await expect(card.getByTestId('this-week-eaten')).toHaveCount(0);
    });

    test('says the plan has ended once today is past its last week', async ({ page }) => {
      const monday = thisMonday();
      await pinThursday(page, monday);
      const longAgo = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 21);
      await stubPlan(page, localIso(longAgo), monday);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'This week' });
      await expect(card.getByRole('status')).toHaveText('The plan has ended.');
      await expect(card.getByTestId('this-week-eaten')).toHaveCount(0);
    });
  });
});
