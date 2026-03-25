# Mobile Nutrition Tab

Redesign the mobile Nutrition tab to support three plan states (no plan, upcoming, active), add swipeable day navigation with week browsing, and a week overview screen.

## Three Plan States

The client's nutrition experience has three states, determined by the active plan and its `StartDate`:

### State 1 — No Plan
No active plan exists (no published weeks). Both the Today tab and Nutrition tab show an empty state card: "Your nutritionist is reviewing your data and preparing a personalized plan. They may reach out for additional information."

### State 2 — Upcoming Plan
Plan has at least one published week but `StartDate` is in the future. The Nutrition tab shows the full published plan (browse weeks/days, view meals) with a gold banner: "Your plan starts on [date]". Meals are read-only — no "mark as eaten". The Today tab shows the same no-plan empty state since there's nothing to log yet.

### State 3 — Active Plan
`StartDate` has arrived. The Today tab shows today's meals with calorie circle and meal logging (existing behavior). The Nutrition tab defaults to today's day with full day/week navigation.

## Nutrition Tab — Day View (Main Screen)

### Layout (top to bottom)
1. **Header:** "Nutrition" title
2. **Week bar:** Left/right arrows to change weeks. Center text shows "Week X of Y" + date range (e.g., "Mar 31 – Apr 6"). Tapping the center text navigates to the week overview screen. Only published weeks are navigable.
3. **Day navigator:** Swipeable area showing day name + full date (e.g., "Wednesday, Apr 2"). Shows "TODAY" badge when applicable. Swipe left/right changes days.
4. **Macro summary bar:** Day totals — kcal, protein, carbs, fat in a horizontal row.
5. **Meal list:** Scrollable meal cards showing meal name, kcal total, food count. Tapping a meal navigates to existing meal detail screen (`nutrition/[mealId]`).

### Day Navigation
- Swipe left/right moves between days within the current week.
- Swiping past Sunday wraps to Monday of the next published week, auto-updating the week bar.
- Swiping before Monday wraps to Sunday of the previous published week.
- When the plan is active, the Nutrition tab opens to today's day in the current week.
- Week/day position is local state — navigating away from the tab and back resets to today.

### Upcoming Plan Banner
When the plan is upcoming (startDate in future), a gold banner appears at the top of the day view: "Your plan starts on [date]". The full plan is browseable but meals have no "mark as eaten" functionality. The tab opens to Week 1 Monday since there is no "today" in the plan yet.

## Week Overview Screen

Separate screen accessed by tapping the center of the week bar.

### Layout
1. **Back navigation:** "‹ Back" returns to the day view at the day the user was on.
2. **Title:** "Week Overview"
3. **Week bar:** Same arrows to switch between published weeks.
4. **Day cards:** 7 cards (Mon–Sun), each showing:
   - Day name
   - "TODAY" highlight with gold left border when applicable
   - Meal count (e.g., "3 meals")
   - Macros: kcal, P, C, F
   - Tapping a day card navigates back to the day view with that day selected.
5. **Weekly average row:** Below the 7 cards, shows daily average macros across the week.

## Today Tab Changes

Minimal changes to the existing Today tab (`mobile/app/(client)/index.tsx`):

- **No plan / Upcoming plan:** Show an empty state card with the "nutritionist is preparing your plan" message. The existing `getTodayPlan()` endpoint returns 404 for both states.
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
  "totalWeeks": 4,
  "publishedWeekCount": 3,
  "globalSettings": { "dailyKcal": 2100, ... },
  "weeks": [ /* only published PlanWeeks with all days/meals/foods */ ],
  "currentWeek": 1,
  "currentDayOfWeek": 3
}
```

**Logic:**
- Find active plan for client (status == Active). If none → 404.
- If `StartDate` is in the future → return the plan with `currentWeek: null` and `currentDayOfWeek: null` (signals "upcoming" state).
- If `StartDate` has arrived → calculate `currentWeek` and `currentDayOfWeek` from `StartDate` using `floor(daysSinceStart / 7) + 1` and `(daysSinceStart % 7) + 1`. Clamp `currentWeek` to published week range.
- Only include weeks where `status == Published`.

### Update Existing Endpoints

**`GET /client/nutrition/plan/today`** (GetTodayPlan):
- Use `StartDate` for day calculation when available (same pattern as `GetTodaySession` for training).
- Return 404 when plan is upcoming (startDate in future).
- Legacy fallback: use `DatePublished` cycling when `StartDate` is null.

**`GET /client/nutrition/plan/week`** (GetWeekPlan):
- Use `StartDate` for week calculation when available.
- Return 404 when plan is upcoming.
- Legacy fallback: use `DatePublished` cycling when `StartDate` is null.

## Mobile API Layer

### New API function
```typescript
interface FullPlanResponse {
  planId: string;
  planName: string;
  startDate: string | null;
  totalWeeks: number;
  publishedWeekCount: number;
  globalSettings: GlobalNutritionSettings | null;
  weeks: PlanWeek[];
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
