# Mobile Nutrition Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the mobile Nutrition tab with swipeable day navigation, week overview screen, and three plan states (no plan, upcoming, active).

**Architecture:** New backend endpoint `GET /client/nutrition/plan/full` returns all published weeks. Update existing `GetTodayPlan`/`GetWeekPlan` to use `StartDate`. Mobile Nutrition tab rebuilt with `react-native-pager-view` for day swiping. New week overview screen. Today tab gets empty state for no-plan.

**Tech Stack:** ASP.NET Core 10 / FastEndpoints / MongoDB / React Native (Expo 55) / React Query / react-native-pager-view / i18next

**Spec:** `docs/superpowers/specs/2026-03-25-mobile-nutrition-tab-design.md`

---

### Task 1: Backend — New GetFullPlan endpoint

**Files:**
- Create: `backend/FitnessPlatform.Application/Features/ClientNutrition/GetFullPlan/GetFullPlanEndpoint.cs`
- Create: `backend/FitnessPlatform.Application/Features/ClientNutrition/GetFullPlan/GetFullPlanResponse.cs`

- [ ] **Step 1: Create GetFullPlanResponse.cs**

```csharp
using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetFullPlan;

/// <summary>
/// Response containing all published weeks of the client's active nutrition plan.
/// </summary>
public class GetFullPlanResponse
{
    /// <summary>External identifier of the nutrition plan.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Display name of the nutrition plan.</summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>The Monday when Week 1 begins, if set.</summary>
    public DateTime? StartDate { get; set; }

    /// <summary>Global daily nutrition targets.</summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>Published weeks with pre-computed date ranges.</summary>
    public List<FullPlanWeek> Weeks { get; set; } = [];

    /// <summary>Number of published weeks.</summary>
    public int PublishedWeekCount { get; set; }

    /// <summary>Current week number (null if plan is upcoming).</summary>
    public int? CurrentWeek { get; set; }

    /// <summary>Current day of week 1-7 (null if plan is upcoming).</summary>
    public int? CurrentDayOfWeek { get; set; }
}

/// <summary>
/// A published week with pre-computed start/end dates.
/// </summary>
public class FullPlanWeek
{
    /// <summary>1-based week number.</summary>
    public int WeekNumber { get; set; }

    /// <summary>ISO date string for the Monday this week starts.</summary>
    public string WeekStartDate { get; set; } = string.Empty;

    /// <summary>ISO date string for the Sunday this week ends.</summary>
    public string WeekEndDate { get; set; } = string.Empty;

    /// <summary>Days in this week.</summary>
    public List<PlanDay> Days { get; set; } = [];
}
```

- [ ] **Step 2: Create GetFullPlanEndpoint.cs**

```csharp
using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetFullPlan;

/// <summary>
/// Returns all published weeks of the client's active nutrition plan.
/// Used by the mobile Nutrition tab for full plan browsing.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetFullPlanEndpoint(IMongoContext mongo) : EndpointWithoutRequest<GetFullPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/plan/full");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get full nutrition plan for browsing";
            s.Description = "Returns all published weeks of the client's active nutrition plan with pre-computed week dates.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);

        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active);

        using var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Determine current week/day
        int? currentWeek = null;
        int? currentDayOfWeek = null;
        DateTime? baseDate = null;

        if (plan.StartDate.HasValue)
        {
            var daysSinceStart = (int)(DateTime.UtcNow.Date - plan.StartDate.Value.Date).TotalDays;
            if (daysSinceStart >= 0)
            {
                // Plan has started
                var weekNum = (daysSinceStart / 7) + 1;
                var dayNum = (daysSinceStart % 7) + 1;

                // Clamp to last published week if beyond range
                var lastPublished = publishedWeeks.Last().WeekNumber;
                if (weekNum > lastPublished)
                {
                    weekNum = lastPublished;
                    dayNum = ((int)DateTime.UtcNow.DayOfWeek == 0 ? 7 : (int)DateTime.UtcNow.DayOfWeek);
                }

                // If calculated week is not published, fall back to last published
                if (!publishedWeeks.Any(w => w.WeekNumber == weekNum))
                    weekNum = lastPublished;

                currentWeek = weekNum;
                currentDayOfWeek = dayNum;
            }
            // else: plan is upcoming, currentWeek stays null
            baseDate = plan.StartDate.Value;
        }
        else if (plan.DatePublished.HasValue)
        {
            // Legacy fallback: use DatePublished cycling
            var daysSincePublish = (int)(DateTime.UtcNow.Date - plan.DatePublished.Value.Date).TotalDays;
            if (daysSincePublish < 0) daysSincePublish = 0;
            var totalPublishedDays = publishedWeeks.Count * 7;
            var cycledDay = daysSincePublish % totalPublishedDays;
            var weekIndex = cycledDay / 7;
            var dayIndex = (cycledDay % 7) + 1;

            currentWeek = publishedWeeks[weekIndex].WeekNumber;
            currentDayOfWeek = dayIndex;
            baseDate = plan.DatePublished.Value;
        }

        // Compute week start/end dates
        var weeks = publishedWeeks.Select(w =>
        {
            var weekStart = baseDate?.Date.AddDays((w.WeekNumber - 1) * 7);
            return new FullPlanWeek
            {
                WeekNumber = w.WeekNumber,
                WeekStartDate = weekStart?.ToString("yyyy-MM-dd") ?? "",
                WeekEndDate = weekStart?.AddDays(6).ToString("yyyy-MM-dd") ?? "",
                Days = w.Days
            };
        }).ToList();

        await Send.OkAsync(new GetFullPlanResponse
        {
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            StartDate = plan.StartDate,
            GlobalSettings = plan.GlobalSettings,
            Weeks = weeks,
            PublishedWeekCount = publishedWeeks.Count,
            CurrentWeek = currentWeek,
            CurrentDayOfWeek = currentDayOfWeek
        }, ct);
    }
}
```

- [ ] **Step 3: Build to verify**

Run: `dotnet build backend/FitnessPlatform.Application/`
Expected: BUILD SUCCEEDED

- [ ] **Step 4: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/ClientNutrition/GetFullPlan/
git commit -m "feat: add GetFullPlan endpoint for mobile nutrition tab browsing"
```

---

### Task 2: Backend — Update GetTodayPlan and GetWeekPlan to use StartDate

**Files:**
- Modify: `backend/FitnessPlatform.Application/Features/ClientNutrition/GetTodayPlan/GetTodayPlanEndpoint.cs`
- Modify: `backend/FitnessPlatform.Application/Features/ClientNutrition/GetWeekPlan/GetWeekPlanEndpoint.cs`

- [ ] **Step 1: Update GetTodayPlanEndpoint.cs**

Replace the week/day calculation logic (lines 55-62) with StartDate-aware logic:

```csharp
// Guard: need published weeks
var publishedWeeks = plan.Weeks
    .Where(w => w.Status == WeekStatus.Published)
    .OrderBy(w => w.WeekNumber)
    .ToList();

if (publishedWeeks.Count == 0)
{
    await Send.NotFoundAsync(ct);
    return;
}

int weekIndex;
int dayIndex;

if (plan.StartDate.HasValue)
{
    var daysSinceStart = (int)(DateTime.UtcNow.Date - plan.StartDate.Value.Date).TotalDays;
    if (daysSinceStart < 0)
    {
        // Plan is upcoming — not started yet
        await Send.NotFoundAsync(ct);
        return;
    }
    var weekNum = (daysSinceStart / 7) + 1;
    dayIndex = daysSinceStart % 7;

    // Find the published week, or fall back to last published
    var targetWeek = publishedWeeks.FirstOrDefault(w => w.WeekNumber == weekNum)
                     ?? publishedWeeks.Last();
    weekIndex = plan.Weeks.IndexOf(targetWeek);
}
else
{
    // Legacy fallback
    var daysSincePublish = (int)(DateTime.UtcNow.Date - plan.DatePublished!.Value.Date).TotalDays;
    if (daysSincePublish < 0) daysSincePublish = 0;
    var totalDays = plan.Weeks.Count * 7;
    var currentDayIndex = daysSincePublish % totalDays;
    weekIndex = currentDayIndex / 7;
    dayIndex = currentDayIndex % 7;
}

var week = plan.Weeks[weekIndex];
var day = week.Days[dayIndex];
```

- [ ] **Step 2: Update GetWeekPlanEndpoint.cs**

Replace the week calculation logic (lines 55-60) with the same StartDate-aware pattern (but only returning the week, not the day):

```csharp
var publishedWeeks = plan.Weeks
    .Where(w => w.Status == WeekStatus.Published)
    .OrderBy(w => w.WeekNumber)
    .ToList();

if (publishedWeeks.Count == 0)
{
    await Send.NotFoundAsync(ct);
    return;
}

PlanWeek week;

if (plan.StartDate.HasValue)
{
    var daysSinceStart = (int)(DateTime.UtcNow.Date - plan.StartDate.Value.Date).TotalDays;
    if (daysSinceStart < 0)
    {
        await Send.NotFoundAsync(ct);
        return;
    }
    var weekNum = (daysSinceStart / 7) + 1;
    week = publishedWeeks.FirstOrDefault(w => w.WeekNumber == weekNum)
           ?? publishedWeeks.Last();
}
else
{
    var daysSincePublish = (int)(DateTime.UtcNow.Date - plan.DatePublished!.Value.Date).TotalDays;
    if (daysSincePublish < 0) daysSincePublish = 0;
    var totalDays = plan.Weeks.Count * 7;
    var currentDayIndex = daysSincePublish % totalDays;
    var weekIndex = currentDayIndex / 7;
    week = plan.Weeks[weekIndex];
}
```

Use `week` (the PlanWeek object) instead of `plan.Weeks[weekIndex]` for the response.

- [ ] **Step 3: Build to verify**

Run: `dotnet build backend/FitnessPlatform.Application/`
Expected: BUILD SUCCEEDED

- [ ] **Step 4: Run tests**

Run: `dotnet test backend/FitnessPlatform.Tests/`
Expected: Same pass rate as before (318/320)

- [ ] **Step 5: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/ClientNutrition/GetTodayPlan/ \
       backend/FitnessPlatform.Application/Features/ClientNutrition/GetWeekPlan/
git commit -m "feat: update GetTodayPlan and GetWeekPlan to use StartDate with legacy fallback"
```

---

### Task 3: Mobile — Install react-native-pager-view and add i18n keys

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/src/i18n/locales/en.json`

- [ ] **Step 1: Install react-native-pager-view**

Run: `cd mobile && npx expo install react-native-pager-view`

- [ ] **Step 2: Add nutrition i18n keys to en.json**

Add a new `"nutrition"` section after `"training"` in `mobile/src/i18n/locales/en.json`:

```json
"nutrition": {
  "title": "Nutrition",
  "noPlanMessage": "Your nutritionist is reviewing your data and preparing a personalized plan. They may reach out for additional information.",
  "planStartsBanner": "Your plan starts on {{date}}",
  "weekLabel": "Week {{current}} of {{total}}",
  "today": "TODAY",
  "meals": "{{count}} meals",
  "meal": "{{count}} meal",
  "weekOverview": "Week Overview",
  "back": "Back",
  "dailyAverage": "Daily Avg",
  "shopping": "Shopping List",
  "kcal": "kcal",
  "protein": "Protein",
  "carbs": "Carbs",
  "fat": "Fat"
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/src/i18n/locales/en.json
git commit -m "feat: install react-native-pager-view and add nutrition i18n keys"
```

---

### Task 4: Mobile — Add FullPlan API types and function

**Files:**
- Modify: `mobile/src/api/nutrition.ts`

- [ ] **Step 1: Add types and API function**

After the existing `ShoppingListResponse` interface (line 118), add:

```typescript
// --- Full Plan types (for Nutrition tab browsing) ---

export interface FullPlanWeek {
  weekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  days: PlanDay[];
}

export interface FullPlanResponse {
  planId: string;
  planName: string;
  startDate: string | null;
  globalSettings: GlobalNutritionSettings | null;
  weeks: FullPlanWeek[];
  publishedWeekCount: number;
  currentWeek: number | null;
  currentDayOfWeek: number | null;
}
```

After the `getShoppingList` function (line 136), add:

```typescript
export async function getFullPlan(): Promise<FullPlanResponse> {
  const { data } = await api.get<FullPlanResponse>('/client/nutrition/plan/full');
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/api/nutrition.ts
git commit -m "feat: add getFullPlan API type and function for nutrition tab"
```

---

### Task 5: Mobile — Rewrite Nutrition tab (day view)

**Files:**
- Rewrite: `mobile/app/(client)/nutrition/index.tsx`

- [ ] **Step 1: Rewrite the Nutrition tab screen**

Replace the entire file with the new implementation. The screen has three states:

1. **Loading** — spinner
2. **No plan (404)** — empty state card with `noPlanMessage`
3. **Plan loaded** — week bar + day pager + meals

Key components:
- Week bar with left/right arrows and tappable center (navigates to week overview)
- `PagerView` for horizontal day swiping
- Macro summary bar showing day totals
- Meal cards that navigate to `nutrition/[mealId]`
- Gold banner for upcoming plans
- Shopping list icon in header

The day pager contains all days across all published weeks as a flat list. Swiping past Sunday wraps to next week's Monday. The week bar auto-updates based on which day page is visible.

Initial page is set to today's day (using `currentWeek` and `currentDayOfWeek` from the API response). For upcoming plans, defaults to page 0 (Week 1 Monday).

Use `useQuery` with `queryKey: ['full-plan']` and `staleTime: 5 * 60 * 1000`.

The screen should handle the 404 case gracefully using `isError` from useQuery (the API returns 404 for no plan/zero published weeks).

- [ ] **Step 2: Verify it compiles**

Run: `cd mobile && npx expo start` — verify no build errors (press `i` for iOS simulator or just check terminal output)

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(client\)/nutrition/index.tsx
git commit -m "feat: rewrite mobile Nutrition tab with swipeable day view and three plan states"
```

---

### Task 6: Mobile — Week Overview screen

**Files:**
- Create: `mobile/app/(client)/nutrition/week-overview.tsx`
- Modify: `mobile/app/(client)/_layout.tsx`

- [ ] **Step 1: Create week-overview.tsx**

A screen that shows 7 day cards for a given week with macros. Accessed by tapping the week bar center. Receives `weekNumber` as a route parameter via `useLocalSearchParams`.

Uses the same `['full-plan']` query data (already cached from the day view).

Layout:
- Header with back button and "Week Overview" title
- Week bar with arrows to switch weeks
- 7 day cards (Mon-Sun) showing: day name, meal count, kcal/P/C/F
- Today highlighted with gold left border
- Tapping a day card navigates back with `weekNumber` and `dayOfWeek` params
- Weekly average row at the bottom

- [ ] **Step 2: Register route in _layout.tsx**

Add after the `nutrition/shopping` hidden route (line 80):

```tsx
<Tabs.Screen name="nutrition/week-overview" options={{ href: null }} />
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(client\)/nutrition/week-overview.tsx mobile/app/\(client\)/_layout.tsx
git commit -m "feat: add week overview screen for mobile nutrition tab"
```

---

### Task 7: Mobile — Today tab empty state

**Files:**
- Modify: `mobile/app/(client)/index.tsx`

- [ ] **Step 1: Add empty state for no plan / upcoming plan**

The Today tab already calls `getTodayPlan()` which returns 404 when there's no plan or when the plan is upcoming. Currently `planQuery.isError` is not handled — the screen shows loading or empty content.

Add an empty state card after the loading check. When `planQuery.isError` or `!planQuery.data`, show:

```tsx
<View style={styles.emptyCard}>
  <Text style={styles.emptyIcon}>🍽️</Text>
  <Text style={styles.emptyTitle}>{t('nutrition.title')}</Text>
  <Text style={styles.emptyMessage}>{t('nutrition.noPlanMessage')}</Text>
</View>
```

Add the styles:

```typescript
emptyCard: {
  margin: 16,
  backgroundColor: Colors.dark.surface,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: Colors.dark.border,
  padding: 32,
  alignItems: 'center',
},
emptyIcon: { fontSize: 40 },
emptyTitle: {
  fontSize: 16,
  fontWeight: '700',
  color: Colors.dark.text2,
  marginTop: 12,
},
emptyMessage: {
  fontSize: 13,
  color: Colors.dark.text3,
  marginTop: 8,
  textAlign: 'center',
  lineHeight: 20,
},
```

Import `useTranslation` if not already imported.

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(client\)/index.tsx
git commit -m "feat: add empty state to Today tab when no nutrition plan exists"
```

---

### Task 8: Final verification

- [ ] **Step 1: Backend build**

Run: `dotnet build backend/FitnessPlatform.Application/`
Expected: BUILD SUCCEEDED

- [ ] **Step 2: Backend tests**

Run: `dotnet test backend/FitnessPlatform.Tests/`
Expected: 318/320 pass (pre-existing failures)

- [ ] **Step 3: Mobile type check**

Run: `cd mobile && npx tsc --noEmit` (if tsconfig exists)
Or verify with: `cd mobile && npx expo start` — check for build errors

- [ ] **Step 4: Commit any fixes**
