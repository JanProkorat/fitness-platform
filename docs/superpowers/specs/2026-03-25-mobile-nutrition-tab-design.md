# Mobile Nutrition Tab

Redesign the mobile Nutrition tab to support three plan states (no plan, upcoming, active), add swipeable day navigation with week browsing, and a week overview screen.

## Three Plan States

The client's nutrition experience has three states, determined by the active plan and its `StartDate`:

### State 1 — No Plan
No active plan exists, OR the plan has zero published weeks. Both the Today tab and Nutrition tab show an empty state card with i18n key `nutrition.noPlanMessage`. The `/plan/full` endpoint returns 404 when no active plan exists or when the active plan has zero published weeks.

### State 2 — Upcoming Plan
Plan has at least one published week but `StartDate` is in the future. The Nutrition tab shows the full published plan (browse weeks/days, view meals) with a gold banner showing the start date (i18n key `nutrition.planStartsBanner`). Meals are read-only — no "mark as eaten". The Today tab shows the same no-plan empty state since there's nothing to log yet.

### State 3 — Active Plan
`StartDate` has arrived (or `StartDate` is null with legacy `DatePublished` fallback). The Today tab shows today's meals with calorie circle and meal logging (existing behavior). The Nutrition tab defaults to today's day with full day/week navigation.

### Edge Cases
- **Active plan, zero published weeks:** Treated as State 1 (404). The `/plan/full` endpoint checks `publishedWeeks.Count == 0` before returning data.
- **`StartDate` is null:** Use legacy `DatePublished` cycling (same as existing endpoints). `currentWeek` and `currentDayOfWeek` are calculated from `DatePublished`. This is State 3 (active) since the plan is already active.
- **Current week beyond last published week:** Clamp `currentWeek` to the last published week number. If the calculated week falls on an unpublished week, fall back to the last published week (same pattern as `GetTodaySessionEndpoint`).
- **Negative days since start (race condition):** Guard against negative `daysSinceStart` — if `StartDate` or `DatePublished` is in the future in existing endpoints, return 404 / treat as upcoming.

## Nutrition Tab — Day View (Main Screen)

**Route:** `mobile/app/(client)/nutrition/index.tsx` (replaces current implementation)

### Layout (top to bottom)
1. **Header:** "Nutrition" title with shopping list icon button (top-right, navigates to existing `nutrition/shopping` screen).
2. **Week bar:** Left/right arrows to change weeks. Center text shows "Week X of Y" + date range (e.g., "Mar 31 – Apr 6"). Tapping the center text navigates to the week overview screen. Only published weeks are navigable.
3. **Day navigator:** Swipeable area showing day name + full date (e.g., "Wednesday, Apr 2"). Shows "TODAY" badge when applicable. Swipe left/right changes days. Use `react-native-pager-view` for performant horizontal swiping.
4. **Macro summary bar:** Day totals — kcal, protein, carbs, fat in a horizontal row.
5. **Meal list:** Scrollable meal cards showing meal name, kcal total, food count. Tapping a meal navigates to existing meal detail screen (`nutrition/[mealId]`).
6. **Pull-to-refresh:** Wraps the scrollable content. The horizontal day swipe is in the non-scrollable header area to avoid gesture conflicts.

### Day Navigation
- Swipe left/right moves between days within the current week.
- Swiping past Sunday wraps to Monday of the next published week, auto-updating the week bar.
- Swiping before Monday wraps to Sunday of the previous published week.
- At plan boundaries (first Monday of first published week, last Sunday of last published week), swiping stops — no wrapping.
- When the plan is active, the Nutrition tab opens to today's day in the current week.
- Week/day position is local state — navigating away from the tab and back resets to today.

### Upcoming Plan Banner
When the plan is upcoming (startDate in future), a gold banner appears at the top of the day view with i18n key `nutrition.planStartsBanner`. The full plan is browseable but meals have no "mark as eaten" functionality. The tab opens to Week 1 Monday since there is no "today" in the plan yet.

## Week Overview Screen

**Route:** `mobile/app/(client)/nutrition/week-overview.tsx` (hidden from tab bar with `href: null` in layout).

Accessed by tapping the center of the week bar. The current week number is passed as a route parameter.

### Layout
1. **Back navigation:** "‹ Back" returns to the day view at the day the user was on.
2. **Title:** "Week Overview"
3. **Week bar:** Same arrows to switch between published weeks.
4. **Day cards:** 7 cards (Mon–Sun), each showing:
   - Day name (localized via `toLocaleDateString`)
   - "TODAY" highlight with gold left border when applicable
   - Meal count (e.g., "3 meals")
   - Macros: kcal, P, C, F
   - Tapping a day card navigates back to the day view with that day selected (passed as route param).
5. **Weekly average row:** Below the 7 cards, shows daily average macros across the week.

## Today Tab Changes

Minimal changes to the existing Today tab (`mobile/app/(client)/index.tsx`):

- **No plan / Upcoming plan:** Show an empty state card with i18n key `nutrition.noPlanMessage`. The existing `getTodayPlan()` endpoint returns 404 for both states.
- **Active plan:** No changes — calorie circle, macro cards, meal list with "mark as eaten" work as before.

## Backend Changes

### New Endpoint: `GET /client/nutrition/plan/full`

Returns all published weeks of the client's active nutrition plan for the Nutrition tab to browse.

**Response shape:**
```json
{
  "planId": "guid",
  "planName": "string",
  "startDate": "2026-03-30T00:00:00Z",
  "globalSettings": { "dailyKcal": 2100 },
  "weeks": [
    {
      "weekNumber": 1,
      "weekStartDate": "2026-03-30",
      "weekEndDate": "2026-04-05",
      "days": [ /* PlanDay with meals/foods */ ]
    }
  ],
  "publishedWeekCount": 3,
  "currentWeek": 1,
  "currentDayOfWeek": 3
}
```

Each week includes pre-computed `weekStartDate` and `weekEndDate` (ISO date strings) to avoid client-side date math and timezone issues.

**Logic:**
- Find active plan for client (status == Active). If none → 404.
- Collect published weeks. If zero → 404.
- If `StartDate` is set and in the future → return the plan with `currentWeek: null` and `currentDayOfWeek: null` (signals "upcoming" state).
- If `StartDate` is set and has arrived → calculate `currentWeek = floor(daysSinceStart / 7) + 1` and `currentDayOfWeek = (daysSinceStart % 7) + 1`. If calculated week is unpublished, fall back to last published week.
- If `StartDate` is null (legacy) → use `DatePublished` cycling to compute `currentWeek` and `currentDayOfWeek`.
- Only include weeks where `status == Published`.
- Compute `weekStartDate` and `weekEndDate` for each week from `StartDate` (or `DatePublished` fallback).

### Update Existing Endpoints

**`GET /client/nutrition/plan/today`** (GetTodayPlan):
- Use `StartDate` for day calculation when available (same pattern as `GetTodaySession` for training).
- Return 404 when plan is upcoming (startDate in future).
- Guard against zero published weeks.
- Legacy fallback: use `DatePublished` cycling when `StartDate` is null.
- Guard against negative `daysSinceStart`.

**`GET /client/nutrition/plan/week`** (GetWeekPlan):
- Use `StartDate` for week calculation when available.
- Return 404 when plan is upcoming.
- Guard against zero published weeks.
- Legacy fallback: use `DatePublished` cycling when `StartDate` is null.
- Guard against negative `daysSinceStart`.

## Mobile API Layer

### New API function
```typescript
interface PlanWeekWithDates extends PlanWeek {
  weekStartDate: string;
  weekEndDate: string;
}

interface FullPlanResponse {
  planId: string;
  planName: string;
  startDate: string | null;
  globalSettings: GlobalNutritionSettings | null;
  weeks: PlanWeekWithDates[];
  publishedWeekCount: number;
  currentWeek: number | null;
  currentDayOfWeek: number | null;
}

function getFullPlan(): Promise<FullPlanResponse>
```

### State determination on mobile
The Nutrition tab calls `getFullPlan()`:
- 404 response → State 1 (no plan)
- Success with `currentWeek == null` → State 2 (upcoming)
- Success with `currentWeek != null` → State 3 (active)

The Today tab continues to call `getTodayPlan()`:
- 404 → show empty state (covers both no plan and upcoming)
- Success → show today's meals as before

### Caching
- `getFullPlan()` uses React Query with `staleTime: 5 * 60 * 1000` (5 minutes) to avoid refetching on every tab switch.
- Pull-to-refresh triggers `refetch()`.

## i18n Keys

New keys needed in `mobile/src/i18n/locales/{en,cs,de}.json` under `nutrition` namespace:

| Key | EN |
|---|---|
| `nutrition.noPlanMessage` | Your nutritionist is reviewing your data and preparing a personalized plan. They may reach out for additional information. |
| `nutrition.planStartsBanner` | Your plan starts on {{date}} |
| `nutrition.weekLabel` | Week {{current}} of {{total}} |
| `nutrition.today` | TODAY |
| `nutrition.meals` | {{count}} meals |
| `nutrition.weekOverview` | Week Overview |
| `nutrition.back` | Back |
| `nutrition.dailyAverage` | Daily Avg |
| `nutrition.shopping` | Shopping List |

Day names and date formatting use `toLocaleDateString()` with the device locale — no hardcoded day name keys needed.
