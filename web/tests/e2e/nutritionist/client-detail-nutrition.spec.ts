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

  test.describe('is it working card and nutrition profile', () => {
    const OLD_PLAN_ID = '00000000-0000-0000-1335-000000000001';
    const NEW_PLAN_ID = '00000000-0000-0000-1335-000000000002';

    interface DashboardBody {
      onboarding?: Record<string, unknown> | null;
      [key: string]: unknown;
    }

    interface Onboarding {
      [key: string]: unknown;
    }

    const FULL_ONBOARDING: Onboarding = {
      targetWeightKg: 75,
      adjustedKcal: 2200,
      proteinGrams: 150,
      carbsGrams: 220,
      fatGrams: 70,
      fibreGrams: 30,
      allergies: 'gluten,lactose,none',
      dislikes: ['Mushrooms'],
      habits: ['Skips breakfast'],
      dateUpdated: '2026-05-14T12:00:00Z',
    };

    /** The page's "now": a Wednesday, so the eight weeks start on Monday 2026-04-20. */
    async function pinNow(page: Page): Promise<void> {
      await page.clock.setFixedTime(new Date(2026, 5, 10, 12, 0, 0));
    }

    /** Rewrites the real client dashboard so the onboarding block is the one under test. */
    async function stubOnboarding(page: Page, onboarding: () => Onboarding | null): Promise<void> {
      await page.route(/\/trainer\/clients\/[^/?]+$/, async (route: Route) => {
        const response = await route.fetch();
        const body = (await response.json()) as DashboardBody;
        await route.fulfill({ response, json: { ...body, onboarding: onboarding() } });
      });
    }

    /** An Active plan since 25 May, preceded by a Completed one; both carry a kcal target unless `withKcal` is false. */
    async function stubPlans(page: Page, options: { onlyNewPlan?: boolean; withKcal?: boolean } = {}): Promise<void> {
      const withKcal = options.withKcal ?? true;
      const oldPlan = {
        planId: OLD_PLAN_ID,
        planType: 'Nutrition',
        name: 'Stub old plan',
        periodStart: '2026-04-13',
        periodEnd: '2026-05-24',
        status: 'Completed',
        ...(withKcal ? { plannedDailyKcal: 2400 } : {}),
      };
      const newPlan = {
        planId: NEW_PLAN_ID,
        planType: 'Nutrition',
        name: 'Stub new plan',
        periodStart: options.onlyNewPlan ? '2026-04-13' : '2026-05-25',
        status: 'Active',
        ...(withKcal ? { plannedDailyKcal: 2200 } : {}),
      };
      await rewritePlansList(page, (body) => ({ ...body, plans: options.onlyNewPlan ? [newPlan] : [oldPlan, newPlan] }));
      await page.route(new RegExp(`/nutrition/plans/${NEW_PLAN_ID}$`), async (route) => {
        await route.fulfill({
          json: {
            planId: NEW_PLAN_ID,
            clientId: '11111111-1111-1111-1111-111111111111',
            nutritionistId: '33333333-3333-3333-3333-333333333333',
            name: 'Stub new plan',
            status: 'Active',
            globalSettings: { dailyKcal: 2200 },
            weeks: [{ weekNumber: 1, status: 'Published', days: [] }],
            version: 1,
            dateCreated: '2026-04-01T00:00:00Z',
            startDate: options.onlyNewPlan ? '2026-04-13' : '2026-05-25',
            mealLogs: [],
            supplements: [],
          },
        });
      });
    }

    /** `control.failing` keeps the request failing through the query client's single retry. */
    async function stubMeasurements(
      page: Page,
      weighIns: [string, number][],
      control: { failing: boolean } = { failing: false },
    ): Promise<void> {
      await page.route(/\/trainer\/clients\/[^/]+\/measurements(\?.*)?$/, async (route) => {
        if (control.failing) {
          await route.fulfill({ status: 500, contentType: 'application/problem+json', body: '{"status":500}' });
          return;
        }
        const items = weighIns.map(([measuredAt, weightKg], index) => ({
          measurementId: `00000000-0000-0000-1335-0000000001${String(index).padStart(2, '0')}`,
          measuredAt,
          weightKg,
        }));
        await route.fulfill({ json: { items, totalCount: items.length, page: 1, pageSize: 50 } });
      });
    }

    const PROGRESS_WEIGH_INS: [string, number][] = [
      ['2026-04-22T08:00:00Z', 82],
      ['2026-05-13T08:00:00Z', 80.6],
      ['2026-06-09T08:00:00Z', 79],
    ];

    test('charts weight against the planned kcal and marks the plan change', async ({ page }) => {
      await pinNow(page);
      await stubOnboarding(page, () => FULL_ONBOARDING);
      await stubPlans(page);
      await stubMeasurements(page, PROGRESS_WEIGH_INS);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Is it working?' });
      await expect(card).toBeVisible();
      await expect(card.getByText('Last 8 weeks', { exact: true })).toBeVisible();

      // 82 kg -> 79 kg over the window, heading for 75 kg at about 0.06 kg a day.
      await expect(card.getByTestId('progress-delta')).toHaveText('-3 kg');
      await expect(card.getByTestId('progress-status')).toHaveText('on track for 75 kg by Aug');

      const chart = card.getByRole('img');
      await expect(chart).toHaveAccessibleName(/Weight change -3 kg over the last 8 weeks.*1 plan changes/);
      await expect(chart.getByTestId('progress-bar')).toHaveCount(8);
      await expect(chart.getByTestId('progress-plan-change')).toHaveCount(1);
      await expect(chart.getByText('new plan', { exact: true })).toBeVisible();
      await expect(chart.getByText('W1', { exact: true })).toBeVisible();
      await expect(chart.getByText('W8', { exact: true })).toBeVisible();
      await expect(card.getByText('Weight (check-ins)', { exact: true })).toBeVisible();
      await expect(card.getByText('Planned kcal a day', { exact: true })).toBeVisible();
    });

    test('says there are too few weigh-ins and still draws the planned kcal', async ({ page }) => {
      await pinNow(page);
      await stubOnboarding(page, () => FULL_ONBOARDING);
      await stubPlans(page, { onlyNewPlan: true });
      await stubMeasurements(page, [['2026-06-09T08:00:00Z', 79]]);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Is it working?' });
      await expect(card.getByTestId('progress-insufficient')).toHaveText('Not enough weigh-ins yet to show a change.');
      await expect(card.getByTestId('progress-delta')).toHaveCount(0);
      await expect(card.getByRole('img').getByTestId('progress-bar')).toHaveCount(8);
      await expect(card.getByRole('img').getByTestId('progress-plan-change')).toHaveCount(0);
    });

    test('shows the empty copy when there is no weigh-in and no kcal target', async ({ page }) => {
      await pinNow(page);
      await stubOnboarding(page, () => FULL_ONBOARDING);
      await stubPlans(page, { withKcal: false });
      await stubMeasurements(page, []);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Is it working?' });
      await expect(card.getByRole('status')).toHaveText(
        'Nothing to show yet. Weigh-ins and a plan with a kcal target will appear here.',
      );
      await expect(card.getByRole('img')).toHaveCount(0);
    });

    test('shows a retry when the weigh-ins fail to load and recovers', async ({ page }) => {
      await pinNow(page);
      await stubOnboarding(page, () => FULL_ONBOARDING);
      await stubPlans(page);
      const control = { failing: true };
      await stubMeasurements(page, PROGRESS_WEIGH_INS, control);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Is it working?' });
      await expect(card.getByText('Failed to load the plan. Please refresh the page.')).toBeVisible();
      // The rest of the tab is unaffected.
      await expect(page.getByRole('region', { name: 'Past plans' })).toBeVisible();

      control.failing = false;
      await card.getByRole('button', { name: 'Retry' }).click();
      await expect(card.getByTestId('progress-delta')).toHaveText('-3 kg');
    });

    test('shows the onboarding targets, allergies, dislikes and habits with the update date', async ({ page }) => {
      await pinNow(page);
      await stubOnboarding(page, () => FULL_ONBOARDING);
      await stubPlans(page);
      await stubMeasurements(page, PROGRESS_WEIGH_INS);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: /nutrition profile$/ });
      await expect(card).toBeVisible();
      for (const heading of ['Targets', 'Allergies', 'Dislikes', 'Habits']) {
        await expect(card.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      }
      for (const chip of ['2,200 kcal', 'P 150 g', 'C 220 g', 'F 70 g', 'Fib 30 g']) {
        await expect(card.getByRole('listitem').filter({ hasText: chip })).toHaveCount(1);
      }
      // Allergies are red and the "none" marker is not listed.
      for (const allergy of ['Gluten', 'Lactose']) {
        await expect(card.getByRole('listitem').filter({ hasText: allergy })).toHaveClass(/text-error/);
      }
      await expect(card.getByRole('listitem').filter({ hasText: 'none' })).toHaveCount(0);
      await expect(card.getByRole('listitem').filter({ hasText: 'Mushrooms' })).toBeVisible();
      await expect(card.getByRole('listitem').filter({ hasText: 'Skips breakfast' })).toBeVisible();
      await expect(card.getByTestId('nutrition-profile-source')).toHaveText('From onboarding · updated May 14');
    });

    test('drops the date from the footer, and the edit action when there is no onboarding', async ({ page }) => {
      await pinNow(page);
      let onboarding: Onboarding | null = { targetWeightKg: 75, adjustedKcal: 2200 };
      await stubOnboarding(page, () => onboarding);
      await stubPlans(page);
      await stubMeasurements(page, PROGRESS_WEIGH_INS);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: /nutrition profile$/ });
      await expect(card.getByTestId('nutrition-profile-source')).toHaveText('From onboarding');
      await expect(card.getByText('None', { exact: true })).toHaveCount(3);

      onboarding = null;
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(card.getByText('No onboarding answers yet', { exact: true })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    });

    test('edits the profile, refreshes the card and keeps the dialog open on errors', async ({ page }) => {
      await pinNow(page);
      let onboarding: Onboarding = { ...FULL_ONBOARDING };
      await stubOnboarding(page, () => onboarding);
      await stubPlans(page);
      await stubMeasurements(page, PROGRESS_WEIGH_INS);

      const requests: Record<string, unknown>[] = [];
      let attempts = 0;
      await page.route(/\/trainer\/clients\/[^/]+\/nutrition-profile$/, async (route) => {
        requests.push(route.request().postDataJSON() as Record<string, unknown>);
        attempts += 1;
        if (attempts === 1) {
          await route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 409, errorCode: 'CLIENT_NUTRITION_PROFILE_MISSING' }),
          });
          return;
        }
        if (attempts === 2) {
          await route.fulfill({ status: 400, contentType: 'application/problem+json', body: '{"status":400}' });
          return;
        }
        const saved = route.request().postDataJSON() as { dislikes: string[]; habits: string[]; fibreGrams?: number };
        onboarding = { ...onboarding, dislikes: saved.dislikes, habits: saved.habits, fibreGrams: saved.fibreGrams };
        await route.fulfill({ json: { ...saved, allergies: ['gluten', 'lactose'] } });
      });

      await openNutritionTab(page);
      const card = page.getByRole('region', { name: /nutrition profile$/ });
      await card.getByRole('button', { name: 'Edit' }).click();

      const dialog = page.getByRole('dialog', { name: 'Edit nutrition profile' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel('Fibre target (g a day)')).toHaveValue('30');
      await expect(dialog.getByLabel('Fibre target (g a day)')).toBeEnabled();

      // A fibre target outside 0-150 is blocked client-side.
      await dialog.getByLabel('Fibre target (g a day)').fill('151');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog.getByRole('alert')).toHaveText('Enter a number from 0 to 150.');
      expect(requests).toHaveLength(0);
      await dialog.getByLabel('Fibre target (g a day)').fill('35');

      const dislikes = dialog.getByLabel('Dislikes');
      await dislikes.fill('Olives');
      await dislikes.press('Enter');
      await expect(dialog.getByRole('button', { name: 'Remove Olives' })).toBeVisible();

      // 409: the translated message, the dialog stays open with the values.
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(
        page.getByText('This client has no nutrition targets or onboarding answers to edit yet.', { exact: true }),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Remove Olives' })).toBeVisible();

      // 400 without a code: the fallback message.
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(
        page.getByText("Couldn't save the nutrition profile. Please try again.", { exact: true }),
      ).toBeVisible();
      await expect(dialog).toBeVisible();

      // Third attempt succeeds: toast, dialog closes, the card refetches the dashboard.
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Nutrition profile saved.', { exact: true })).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(card.getByRole('listitem').filter({ hasText: 'Olives' })).toBeVisible();
      await expect(card.getByRole('listitem').filter({ hasText: 'Fib 35 g' })).toBeVisible();

      expect(requests).toHaveLength(3);
      for (const body of requests) {
        expect(body).toMatchObject({
          allergies: ['gluten', 'lactose'],
          dislikes: ['Mushrooms', 'Olives'],
          habits: ['Skips breakfast'],
          fibreGrams: 35,
        });
      }
    });

    test('disables the fibre target when the client has no targets', async ({ page }) => {
      await pinNow(page);
      await stubOnboarding(page, () => ({ targetWeightKg: 75, dislikes: ['Mushrooms'] }));
      await stubPlans(page);
      await stubMeasurements(page, PROGRESS_WEIGH_INS);
      await openNutritionTab(page);

      await page.getByRole('region', { name: /nutrition profile$/ }).getByRole('button', { name: 'Edit' }).click();
      const dialog = page.getByRole('dialog', { name: 'Edit nutrition profile' });
      await expect(dialog.getByLabel('Fibre target (g a day)')).toBeDisabled();
      await expect(dialog.getByText('Set calorie and macro targets before adding a fibre target.')).toBeVisible();
    });
  });

  test.describe('meal photos and notes card', () => {
    const PHOTO_HOST = 'https://photos.stub.test';
    const PIXEL_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const OTHER_CLIENT_USER_ID = '99999999-9999-9999-9999-999999999999';
    const NUTRITION_CHECK_IN_ID = '00000000-0000-0000-1336-0000000000a1';
    const TRAINING_CHECK_IN_ID = '00000000-0000-0000-1336-0000000000a2';
    const OTHER_CLIENT_CHECK_IN_ID = '00000000-0000-0000-1336-0000000000a3';
    const COMPLETED_PLAN_ID = '00000000-0000-0000-1336-000000000001';

    /** The page's "now": Thursday 11 June 2026, noon, so the week runs Mon 8 June to Sun 14 June. */
    const NOW = new Date(2026, 5, 11, 12, 0, 0);
    const MONDAY = new Date(2026, 5, 8);
    const NEXT_MONDAY = new Date(2026, 5, 15);

    function atLocalNoon(day: number): string {
      return new Date(2026, 5, day, 12, 0, 0).toISOString();
    }

    function weekday(day: number): string {
      return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(2026, 5, day, 12, 0, 0));
    }

    function checkInDate(day: number): string {
      return new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(
        new Date(2026, 5, day, 12, 0, 0),
      );
    }

    async function pinNow(page: Page): Promise<void> {
      await page.clock.setFixedTime(NOW);
    }

    function photo(id: string, takenAtDay: number, mealKind: string | null, displayUrl = `${PHOTO_HOST}/ok-${id}.png`) {
      return {
        id: `00000000-0000-0000-1336-0000000001${id}`,
        blobUrl: `client-photos/${id}`,
        displayUrl,
        category: 'Food',
        planType: 'Nutrition',
        mealKind,
        takenAt: atLocalNoon(takenAtDay),
      };
    }

    const MEAL_PHOTOS = [
      photo('01', 8, 'Breakfast'),
      photo('02', 9, 'MorningSnack'),
      photo('03', 10, 'Dinner'),
      photo('04', 11, null),
      photo('05', 10, 'Lunch', `${PHOTO_HOST}/expired.png`),
    ];

    /** Answers the pre-signed image URLs: the expired one is a 403 like MinIO's. */
    async function stubImages(page: Page): Promise<void> {
      await page.route(`${PHOTO_HOST}/**`, async (route) => {
        if (route.request().url().endsWith('/expired.png')) {
          await route.fulfill({ status: 403, body: 'expired' });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG });
      });
    }

    /** `control.failing` keeps the request failing through the query client's single retry. */
    async function stubPhotos(
      page: Page,
      photos: Record<string, unknown>[],
      control: { failing: boolean } = { failing: false },
      requests: URL[] = [],
    ): Promise<void> {
      await stubImages(page);
      await page.route(/\/trainer\/clients\/[^/]+\/photos(\?.*)?$/, async (route) => {
        requests.push(new URL(route.request().url()));
        if (control.failing) {
          await route.fulfill({ status: 500, contentType: 'application/problem+json', body: '{"status":500}' });
          return;
        }
        await route.fulfill({ json: { photos } });
      });
    }

    interface CheckInStub {
      weeks: { weekStartDate: string; status: string; hungerScore?: number }[];
      detail: Record<string, unknown>;
      control: { failing: boolean };
      calls: { list: string[]; detail: string[] };
    }

    function checkInStub(overrides: Partial<CheckInStub> = {}): CheckInStub {
      return {
        weeks: [
          { weekStartDate: '2026-05-25', status: 'answered', hungerScore: 2 },
          { weekStartDate: '2026-06-01', status: 'answered', hungerScore: 4 },
          { weekStartDate: '2026-06-08', status: 'waiting' },
        ],
        detail: { note: 'Felt hungry in the evenings', hungerScore: 4 },
        control: { failing: false },
        calls: { list: [], detail: [] },
        ...overrides,
      };
    }

    /**
     * Stubs the three check-in calls. The list rows carry the client's user id taken from the history
     * URL, so the card has to pick the right rows out of a list that also holds another client's.
     */
    async function stubCheckIns(page: Page, stub: CheckInStub): Promise<void> {
      let clientUserId = '';
      const failure = async (route: Route) => {
        await route.fulfill({ status: 500, contentType: 'application/problem+json', body: '{"status":500}' });
      };

      await page.route(/\/trainer\/clients\/[^/]+\/weekly-check-ins\/history(\?.*)?$/, async (route) => {
        if (stub.control.failing) {
          await failure(route);
          return;
        }
        clientUserId = /\/trainer\/clients\/([^/]+)\//.exec(route.request().url())?.[1] ?? '';
        await route.fulfill({ json: { weeks: stub.weeks, answeredCount: 2, totalCount: 2 } });
      });

      await page.route(/\/trainer\/weekly-check-ins(\?.*)?$/, async (route) => {
        stub.calls.list.push(new URL(route.request().url()).searchParams.get('weekStartDate') ?? '');
        const row = (id: string, userId: string, profession: string, respondedAt: string | null) => ({
          id,
          clientUserId: userId,
          clientPublicId: userId,
          clientName: 'Stub client',
          profession,
          weekStartDate: '2026-06-01',
          flags: [],
          note: null,
          sentAt: atLocalNoon(5),
          respondedAt,
          dismissedByClientAt: null,
          reviewedByTrainerAt: atLocalNoon(9),
          status: respondedAt ? 'Reviewed' : 'Pending',
          dueAt: null,
        });
        await route.fulfill({
          json: {
            checkIns: [
              row(OTHER_CLIENT_CHECK_IN_ID, OTHER_CLIENT_USER_ID, 'Nutrition', atLocalNoon(8)),
              // A newer Training answer must not win over the Nutrition one.
              row(TRAINING_CHECK_IN_ID, clientUserId, 'Training', atLocalNoon(8)),
              row(NUTRITION_CHECK_IN_ID, clientUserId, 'Nutrition', atLocalNoon(7)),
            ],
          },
        });
      });

      await page.route(/\/trainer\/weekly-check-ins\/[^/?]+$/, async (route) => {
        const id = route.request().url().split('/').pop() ?? '';
        stub.calls.detail.push(id);
        await route.fulfill({
          json: {
            id,
            clientUserId,
            clientName: 'Stub client',
            professionalUserId: '33333333-3333-3333-3333-333333333333',
            profession: 'Nutrition',
            weekStartDate: '2026-06-01',
            flags: [],
            sentAt: atLocalNoon(5),
            respondedAt: atLocalNoon(7),
            dismissedByClientAt: null,
            reviewedByTrainerAt: null,
            status: 'Responded',
            dueAt: null,
            ...stub.detail,
          },
        });
      });
    }

    test('captions one photo per meal group, asks for this week only and shows the note', async ({ page }) => {
      await pinNow(page);
      const photoRequests: URL[] = [];
      await stubPhotos(page, MEAL_PHOTOS, { failing: false }, photoRequests);
      const stub = checkInStub();
      await stubCheckIns(page, stub);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Meal photos and notes' });
      await expect(card).toBeVisible();
      await expect(card.getByText('This week', { exact: true })).toBeVisible();

      const tiles = card.getByTestId('meal-photo');
      await expect(tiles).toHaveCount(5);
      // Breakfast, Snack (MorningSnack) and Dinner each use the "this week" row labels; a null meal kind is the weekday alone.
      await expect(tiles.nth(0)).toHaveText(`Breakfast · ${weekday(8)}`);
      await expect(tiles.nth(1)).toHaveText(`Snack · ${weekday(9)}`);
      await expect(tiles.nth(2)).toHaveText(`Dinner · ${weekday(10)}`);
      await expect(tiles.nth(3)).toHaveText(weekday(11));
      await expect(tiles.nth(3)).not.toContainText('·');

      // Pre-signed URLs render; the expired one falls back to a placeholder that keeps its caption.
      await expect(tiles.nth(0).getByRole('img')).toHaveAttribute('src', `${PHOTO_HOST}/ok-01.png`);
      await expect(tiles.nth(4)).toHaveText(`Lunch · ${weekday(10)}`);
      await expect(tiles.nth(4).getByTestId('meal-photo-unavailable')).toBeVisible();
      await expect(card.getByTestId('meal-photo-unavailable')).toHaveCount(1);

      // Only Food photos from Monday 00:00 to the last millisecond of Sunday, local time.
      expect(photoRequests.length).toBeGreaterThan(0);
      const params = photoRequests[0].searchParams;
      expect(params.get('category')).toBe('Food');
      expect(params.get('pageSize')).toBe('6');
      expect(params.get('from')).toBe(MONDAY.toISOString());
      expect(params.get('to')).toBe(new Date(NEXT_MONDAY.getTime() - 1).toISOString());

      // The note comes from the newest answered week, the client's own Nutrition row.
      const note = card.getByTestId('check-in-note');
      await expect(note).toContainText('“Felt hungry in the evenings”');
      await expect(note.getByTestId('check-in-meta')).toHaveText(`Check-in · ${checkInDate(7)} · hunger 4/5`);
      expect(stub.calls.list).toEqual(['2026-06-01']);
      expect(stub.calls.detail).toEqual([NUTRITION_CHECK_IN_ID]);
    });

    test('says there is no note and drops the hunger part when the check-in has neither', async ({ page }) => {
      await pinNow(page);
      await stubPhotos(page, MEAL_PHOTOS);
      await stubCheckIns(page, checkInStub({ detail: { note: null, hungerScore: null } }));
      await openNutritionTab(page);

      const note = page.getByRole('region', { name: 'Meal photos and notes' }).getByTestId('check-in-note');
      await expect(note.getByText('No note in the latest check-in')).toBeVisible();
      await expect(note.getByTestId('check-in-meta')).toHaveText(`Check-in · ${checkInDate(7)}`);
      await expect(note.locator('blockquote')).toHaveCount(0);
    });

    test('says no check-in was answered yet without asking for a list or a detail', async ({ page }) => {
      await pinNow(page);
      await stubPhotos(page, MEAL_PHOTOS);
      const stub = checkInStub({
        weeks: [
          { weekStartDate: '2026-06-01', status: 'missed' },
          { weekStartDate: '2026-06-08', status: 'waiting' },
        ],
      });
      await stubCheckIns(page, stub);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Meal photos and notes' });
      await expect(card.getByText('No check-in answered yet')).toBeVisible();
      await expect(card.getByTestId('meal-photo')).toHaveCount(5);
      expect(stub.calls.list).toHaveLength(0);
      expect(stub.calls.detail).toHaveLength(0);
    });

    test('shows the empty copy when there are no photos this week and still shows the note', async ({ page }) => {
      await pinNow(page);
      await stubPhotos(page, []);
      await stubCheckIns(page, checkInStub());
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Meal photos and notes' });
      await expect(card.getByText('No meal photos this week.')).toBeVisible();
      await expect(card.getByTestId('meal-photo')).toHaveCount(0);
      await expect(card.getByTestId('check-in-note')).toContainText('Felt hungry in the evenings');
    });

    test('shows a retry when the photos fail to load, keeps the rest of the tab and recovers', async ({ page }) => {
      await pinNow(page);
      const control = { failing: true };
      await stubPhotos(page, MEAL_PHOTOS, control);
      await stubCheckIns(page, checkInStub());
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Meal photos and notes' });
      await expect(card.getByText("Couldn't load the meal photos.")).toBeVisible();
      // The note and the other cards still render.
      await expect(card.getByTestId('check-in-note')).toContainText('Felt hungry in the evenings');
      await expect(page.getByRole('region', { name: 'Past plans' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Is it working?' })).toBeVisible();

      control.failing = false;
      await card.getByRole('button', { name: 'Retry' }).click();
      await expect(card.getByTestId('meal-photo')).toHaveCount(5);
    });

    test('shows a retry inside the note block when a check-in call fails and keeps the photos', async ({ page }) => {
      await pinNow(page);
      await stubPhotos(page, MEAL_PHOTOS);
      const stub = checkInStub({ control: { failing: true } });
      await stubCheckIns(page, stub);
      await openNutritionTab(page);

      const card = page.getByRole('region', { name: 'Meal photos and notes' });
      const note = card.getByTestId('check-in-note');
      await expect(note.getByText("Couldn't load the latest check-in.")).toBeVisible();
      await expect(card.getByTestId('meal-photo')).toHaveCount(5);
      await expect(card.getByText("Couldn't load the meal photos.")).toHaveCount(0);

      stub.control.failing = false;
      await note.getByRole('button', { name: 'Retry' }).click();
      await expect(note).toContainText('Felt hungry in the evenings');
    });

    test('keeps Duplicate disabled and sends no copy request', async ({ page }) => {
      await pinNow(page);
      await stubPhotos(page, []);
      await stubCheckIns(page, checkInStub());
      await rewritePlansList(page, (body) => ({
        ...body,
        plans: [
          ...body.plans,
          {
            planId: COMPLETED_PLAN_ID,
            planType: 'Nutrition',
            name: 'Stub finished plan',
            periodStart: '2026-01-05',
            periodEnd: '2026-02-01',
            status: 'Completed',
          },
        ],
      }));
      let copyRequests = 0;
      await page.route(/\/nutrition\/plans\/[^/]+\/copy$/, async (route) => {
        copyRequests += 1;
        await route.fulfill({ status: 201, json: { planId: COMPLETED_PLAN_ID, status: 'Draft' } });
      });
      await openNutritionTab(page);

      await page.getByRole('region', { name: 'Past plans' }).getByRole('button', { name: /Actions for Stub finished/ }).click();
      const duplicate = page.getByRole('menuitem', { name: /Duplicate for/ });
      await expect(duplicate).toHaveAttribute('aria-disabled', 'true');
      await duplicate.click({ force: true });
      expect(copyRequests).toBe(0);
    });
  });
});
