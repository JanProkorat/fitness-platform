# Plans Page Rework — Design Spec

## Summary

Rework the nutrition plan editor page to:
1. Replace continuous auto-save with a single full-state save via one PUT endpoint
2. Add two tabs under the plan name bar: "Meal Plan" (editor) and "Nutrition Goals" (read-only reference)
3. Move plan-level publish to per-week Draft/Published status
4. Pre-create meal sections in day columns based on client's meal distribution
5. Show calorie warnings when a meal exceeds its distribution target

## UI Layout

### Page Structure

```
┌──────────────────────────────────────────────────────┐
│ ← Back to Plans                                      │
├──────────────────────────────────────────────────────┤
│ Plan Name                    [Unsaved] [💾 Save]     │
├──────────────────────────────────────────────────────┤
│ [🍽️ Meal Plan]  [📊 Nutrition Goals]                 │
├──────────────────────────────────────────────────────┤
│ (tab content below)                                  │
└──────────────────────────────────────────────────────┘
```

### Meal Plan Tab

**Week selector row** (below tabs, inside this tab):
- Week buttons with per-week status badges (Draft/Published)
- "Publish Week X" button (shown for Draft weeks only)
- "+ Add Week" button
- "Remove Week" button

**Day columns** (7 columns, Mon–Sun):
- Day label at top
- Day nutrition totals below label: kcal, Protein, Carbs, Fat
- Pre-created meal sections based on client's meal distribution (only for days with zero meals; existing meals are preserved as-is)
- Meals with 0% distribution are hidden during pre-creation
- Each meal section shows:
  - Meal name + calorie target (from distribution % × daily kcal)
  - List of foods with amounts
  - Meal nutrition totals
  - Red left border + "⚠️ +N" warning when meal kcal exceeds target
  - "+ Food" and "+ Recipe" buttons
- Drag-and-drop for meal reordering and cross-day moves (unchanged)

**Fallback when client has no meal distribution data:**
If the client has no onboarding data or meal distribution is null, day columns show no pre-created meal sections. The nutritionist can manually add meals. Calorie targets are not shown (no distribution to derive them from). The Nutrition Goals tab shows a message: "Nutrition goals not configured. Set them on the client detail page."

### Nutrition Goals Tab

Read-only display of the client's nutrition data, fetched via `getClientDashboard(clientId)`:
- BMR → TDEE → Adjusted Kcal flow
- Activity level and nutrition goal
- Macro targets: Protein, Carbs, Fat (colored boxes)
- Donut chart (macro percentage split)
- Meal distribution bars (5 meals with percentages and kcal)

All components rendered in read-only mode — editing happens on the Client Detail page.

## Data Model Changes

### PlanWeek — add per-week status

```csharp
public class PlanWeek
{
    public int WeekNumber { get; set; }
    public WeekStatus Status { get; set; }        // NEW: Draft | Published
    public DateTime? DatePublished { get; set; }   // NEW
    public List<PlanDay> Days { get; set; }
}

public enum WeekStatus
{
    Draft,
    Published
}
```

### NutritionPlan — keep plan-level status, derive from weeks

Keep `NutritionPlanStatus Status` on the plan document but make it **computed/derived**:
- `Draft` — all weeks are Draft
- `Active` — at least one week is Published
- `Archived` — explicitly set by the trainer (separate action, same as before)

The plan-level `DatePublished` field is dropped from the MongoDB document (existing values are ignored on read). The `GetPlans` endpoint continues to return `status` and support filtering by it. The `PlansPage` continues to show status badges and filter as before.

The existing archive behavior (when a new plan is published for the same client, old plans get archived) now triggers when any week in a new plan is published.

### No changes to

PlanDay, PlanMeal, MealFood, GlobalNutritionSettings — these stay as-is.

## Backend API Changes

### Modified: `PUT /nutrition/plans/{planId}`

Accepts the full plan state. The backend replaces the entire weeks/days/meals structure.

```csharp
public class UpdatePlanRequest
{
    public Guid PlanId { get; set; }
    public string Name { get; set; }
    public GlobalNutritionSettings? GlobalSettings { get; set; }
    public List<UpdateWeekRequest> Weeks { get; set; }
    public int Version { get; set; }
}

public class UpdateWeekRequest
{
    public int WeekNumber { get; set; }
    public List<UpdateDayRequest> Days { get; set; }
}

public class UpdateDayRequest
{
    public int DayOfWeek { get; set; }  // 1-7
    public List<UpdateMealRequest> Meals { get; set; }
}

public class UpdateMealRequest
{
    public Guid? MealId { get; set; }  // null for new meals → backend generates Guid
    public string Name { get; set; }
    public int Order { get; set; }
    public List<UpdateMealFoodRequest> Foods { get; set; }
}

public class UpdateMealFoodRequest
{
    public Guid FoodExternalId { get; set; }
    public string FoodName { get; set; }
    public NutrientValue NutrientValuePer100Grams { get; set; }
    public decimal AmountGrams { get; set; }
    // Foods are ordered by their position in the list (list index = display order)
}
```

**Week status preservation logic:**
The backend matches incoming weeks to existing weeks by `WeekNumber`:
- Existing weeks: carry forward `Status` and `DatePublished` from the current document
- New weeks (WeekNumber not in current document): initialize with `Status = Draft`, `DatePublished = null`
- Weeks removed from the request: deleted from the plan (published weeks cannot be removed — returns 400)

**Behavior:**
- Validates version for optimistic concurrency (409 on mismatch)
- Replaces weeks/days/meals structure with submitted data
- Published weeks can be edited (to fix typos/mistakes) but cannot be removed
- Recalculates nutrient totals for all meals and days using the denormalized `NutrientValuePer100Grams` data
- Recomputes plan-level `Status` (Draft if all weeks Draft, Active if any Published)
- Increments version
- Returns updated plan detail

**Validation rules:**
- `Name`: required, max 200 characters
- `Weeks`: 1–52 weeks, no duplicate `WeekNumber` values
- `DayOfWeek`: 1–7, no duplicates within a week
- `Meals`: max 20 per day, no duplicate `MealId` values within a day
- `Foods`: max 50 per meal
- `AmountGrams`: > 0, max 10000
- `FoodName`: required
- Published weeks cannot be removed (but can be edited)

### New: `POST /nutrition/plans/{planId}/weeks/{weekNumber}/publish`

- Sets `week.Status = Published` and `week.DatePublished = DateTime.UtcNow`
- Recomputes plan-level `Status` to `Active`
- Triggers archive of other active plans for the same client (existing behavior)
- Accepts `Version` in request body for optimistic concurrency (409 on mismatch)
- Returns updated plan

### Removed endpoints

These are replaced by the full-state PUT:
- `POST /nutrition/plans/{planId}/meals` (addMeal)
- `DELETE /nutrition/plans/{planId}/meals/{mealId}` (deleteMeal)
- `POST /nutrition/plans/{planId}/meals/{mealId}/foods` (addFoodToMeal)
- `DELETE /nutrition/plans/{planId}/meals/{mealId}/foods/{foodId}` (removeFoodFromMeal)
- `PUT /nutrition/plans/{planId}/days/{dayOfWeek}` (updateDay)
- `PUT /nutrition/plans/{planId}/meals/{mealId}` (updateMeal)
- `POST /nutrition/plans/{planId}/publish` (plan-level publish)
- `POST /nutrition/plans/{planId}/duplicate` (duplicate plan — feature removed)

### Kept as-is

- `GET /nutrition/plans` — list plans (still filters by plan-level status)
- `GET /nutrition/plans/{planId}` — get plan detail (now includes per-week status)
- `POST /nutrition/plans` — create plan (all weeks start as Draft)
- `DELETE /nutrition/plans/{planId}` — delete plan

## Frontend Architecture

### Zustand Store (`nutritionPlan.ts`)

Simplified — all mutations are local-only until Save:

**Remove:**
- All individual API persist functions (`persistDays`, `addFoodToMeal` API call, `removeFoodFromMeal` API call, etc.)
- Debounced auto-save logic

**Keep (local state only):**
- `reorderMeals()`, `moveMealToDay()`, `swapDays()` — update in-memory state, set `isDirty = true`
- `addFoodToMeal()`, `removeFoodFromMeal()`, `updateFoodAmount()` — local only
- `addMeal()`, `removeMeal()`, `updateMealName()` — local only

**Add:**
- `save()` — single action that calls `PUT /nutrition/plans/{planId}` with full plan state, updates version on success, sets `isDirty = false`
- `publishWeek(weekNumber)` — calls publish endpoint, updates plan state
- `addWeek()` — appends a new week (Draft) to local state, `weekNumber = max + 1`
- `removeWeek(weekNumber)` — removes a week from local state. Cannot remove published weeks (button disabled). Must keep at least 1 week.

**409 conflict handling:** On save failure with 409, show a toast: "Plan was modified elsewhere. Reloading..." and refetch the plan. Local changes are lost — this is acceptable since manual save means the user is aware of their changes.

### NutritionPlanPage.tsx

- Remove auto-save `useEffect` and debounce timer
- Add tab state: `activeTab: 'mealPlan' | 'nutritionGoals'`
- Meal Plan tab: week selector + day columns (existing editor logic)
- Nutrition Goals tab: fetch `getClientDashboard(plan.clientId)` on mount, render read-only BMR/TDEE/macros/meal distribution using existing components (`MacroSliders`, `MealDistribution`) in read-only mode
- Save button in toolbar calls `store.save()`

### PlanToolbar.tsx

- Plan name + Save button + unsaved changes indicator (top bar)
- Tabs row below

### Week selector (inside Meal Plan tab)

- Week buttons with Draft/Published badges
- "Publish Week X" button for current Draft week
- "+ Add Week" / "Remove Week" buttons
- "Remove Week" disabled for published weeks and when only 1 week remains

### DayColumn.tsx

- Day nutrition totals (kcal, P, C, F) displayed under day label
- Meal sections pre-created from client's meal distribution data (only for empty days)
- 0% meals hidden during pre-creation
- Calorie target shown per meal: `distribution% × dailyKcal`
- Warning indicator (red border + "⚠️ +N") when actual > target
- "+ Food" and "+ Recipe" buttons at bottom of each meal

### Data flow for meal distribution targets

The plan page needs the client's meal distribution percentages and nutrition targets. On page load:
1. Fetch plan via `getPlan(planId)` — provides `clientId`
2. Fetch client data via `getClientDashboard(clientId)` — provides meal distribution, macro targets, BMR/TDEE
3. Both are available for the Meal Plan tab (targets) and Nutrition Goals tab (read-only display)

## Mockups

Visual mockups are saved in `.superpowers/brainstorm/` (plan-layout-v3.html is the approved version).
