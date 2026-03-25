# Plan Start Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional start date (always a Monday) to nutrition and training plans that gates publishing and drives the mobile "show today's week" behavior.

**Architecture:** Add `StartDate` (DateTime?, midnight UTC) to both MongoDB plan documents. Modify existing create/update/publish endpoints with validation. Add date picker to web create drawers and plan detail headers. Update WeekSelector to show date ranges. Update mobile GetTodaySession to use start date for week calculation.

**Tech Stack:** ASP.NET Core 10 / FastEndpoints / MongoDB / React 18 / TypeScript / Zustand / React Native (Expo)

**Spec:** `docs/superpowers/specs/2026-03-25-plan-start-date-design.md`

---

### Task 1: Backend — Add error codes and document fields

**Files:**
- Modify: `backend/FitnessPlatform.Application/Domain/Constants/ErrorCodes.cs`
- Modify: `backend/FitnessPlatform.Application/Domain/Documents/NutritionPlan.cs`
- Modify: `backend/FitnessPlatform.Application/Domain/Documents/TrainingPlan.cs`

- [ ] **Step 1: Add start date error codes to ErrorCodes.cs**

After the `PlanNotDraft` constant (line 70), add:

```csharp
/// <summary>Start date is not a Monday.</summary>
public const string StartDateNotMonday = "START_DATE_NOT_MONDAY";

/// <summary>Start date is in the past.</summary>
public const string StartDateInPast = "START_DATE_IN_PAST";

/// <summary>Start date is locked because it has already arrived.</summary>
public const string StartDateLocked = "START_DATE_LOCKED";

/// <summary>Start date is required before publishing.</summary>
public const string StartDateRequired = "START_DATE_REQUIRED";

/// <summary>The target week's start Monday is in the past.</summary>
public const string WeekStartInPast = "WEEK_START_IN_PAST";
```

- [ ] **Step 2: Add StartDate to NutritionPlan document**

After `DatePublished` (line 84) in `NutritionPlan.cs`, add:

```csharp
/// <summary>
/// The Monday when Week 1 begins. Stored as midnight UTC. Null until set.
/// </summary>
[BsonElement("startDate")]
[BsonIgnoreIfNull]
public DateTime? StartDate { get; set; }
```

- [ ] **Step 3: Add StartDate to TrainingPlan document**

After `DatePublished` (line 87) in `TrainingPlan.cs`, add:

```csharp
/// <summary>
/// The Monday when Week 1 begins. Stored as midnight UTC. Null until set.
/// </summary>
[BsonElement("startDate")]
[BsonIgnoreIfNull]
public DateTime? StartDate { get; set; }
```

- [ ] **Step 4: Commit**

```bash
git add backend/FitnessPlatform.Application/Domain/Constants/ErrorCodes.cs \
       backend/FitnessPlatform.Application/Domain/Documents/NutritionPlan.cs \
       backend/FitnessPlatform.Application/Domain/Documents/TrainingPlan.cs
git commit -m "feat: add StartDate field to plan documents and start date error codes"
```

---

### Task 2: Backend — Update create plan endpoints

**Files:**
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/CreatePlan/CreatePlanRequest.cs`
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/CreatePlan/CreatePlanValidator.cs`
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/CreatePlan/CreatePlanEndpoint.cs`
- Modify: `backend/FitnessPlatform.Application/Features/TrainingPlans/CreateTrainingPlan/CreateTrainingPlanRequest.cs`
- Modify: `backend/FitnessPlatform.Application/Features/TrainingPlans/CreateTrainingPlan/CreateTrainingPlanValidator.cs`
- Modify: `backend/FitnessPlatform.Application/Features/TrainingPlans/CreateTrainingPlan/CreateTrainingPlanEndpoint.cs`

- [ ] **Step 1: Add StartDate to CreatePlanRequest.cs**

After `WeekCount` (line 28), add:

```csharp
/// <summary>
/// Optional start date for the plan. Must be a Monday and not in the past.
/// Transmitted as ISO date string (e.g. "2026-03-30"), stored as midnight UTC.
/// </summary>
public DateTime? StartDate { get; set; }
```

- [ ] **Step 2: Add validation to CreatePlanValidator.cs**

After the `WeekCount` rule (line 24), add:

```csharp
RuleFor(x => x.StartDate)
    .Must(d => d!.Value.DayOfWeek == System.DayOfWeek.Monday)
    .WithErrorCode(Domain.Constants.ErrorCodes.StartDateNotMonday)
    .WithMessage("Start date must be a Monday.")
    .When(x => x.StartDate.HasValue);

RuleFor(x => x.StartDate)
    .Must(d => DateOnly.FromDateTime(d!.Value) >= DateOnly.FromDateTime(DateTime.UtcNow))
    .WithErrorCode(Domain.Constants.ErrorCodes.StartDateInPast)
    .WithMessage("Start date cannot be in the past.")
    .When(x => x.StartDate.HasValue);
```

- [ ] **Step 3: Set StartDate in CreatePlanEndpoint.cs**

In the `new NutritionPlan` initializer (line 55-76), add after `DateCreated = now`:

```csharp
StartDate = req.StartDate?.Date
```

(`.Date` strips any time component to ensure midnight.)

- [ ] **Step 4: Add StartDate to CreateTrainingPlanRequest.cs**

After `WeekCount` (line 26), add:

```csharp
/// <summary>
/// Optional start date for the plan. Must be a Monday and not in the past.
/// </summary>
public DateTime? StartDate { get; set; }
```

- [ ] **Step 5: Add validation to CreateTrainingPlanValidator.cs**

After the `Description` rule (line 28), add:

```csharp
RuleFor(x => x.StartDate)
    .Must(d => d!.Value.DayOfWeek == System.DayOfWeek.Monday)
    .WithErrorCode(Domain.Constants.ErrorCodes.StartDateNotMonday)
    .WithMessage("Start date must be a Monday.")
    .When(x => x.StartDate.HasValue);

RuleFor(x => x.StartDate)
    .Must(d => DateOnly.FromDateTime(d!.Value) >= DateOnly.FromDateTime(DateTime.UtcNow))
    .WithErrorCode(Domain.Constants.ErrorCodes.StartDateInPast)
    .WithMessage("Start date cannot be in the past.")
    .When(x => x.StartDate.HasValue);
```

- [ ] **Step 6: Set StartDate in CreateTrainingPlanEndpoint.cs**

In the `new TrainingPlan` initializer (line 55-71), add after `DateCreated = now`:

```csharp
StartDate = req.StartDate?.Date
```

- [ ] **Step 7: Build to verify**

Run: `dotnet build backend/FitnessPlatform.Application/`
Expected: BUILD SUCCEEDED

- [ ] **Step 8: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/NutritionPlans/CreatePlan/ \
       backend/FitnessPlatform.Application/Features/TrainingPlans/CreateTrainingPlan/
git commit -m "feat: add optional StartDate to create plan endpoints with validation"
```

---

### Task 3: Backend — Update plan endpoints

**Files:**
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/UpdatePlan/UpdatePlanRequest.cs`
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/UpdatePlan/UpdatePlanEndpoint.cs`
- Modify: `backend/FitnessPlatform.Application/Features/TrainingPlans/UpdateTrainingPlan/UpdateTrainingPlanRequest.cs`
- Modify: `backend/FitnessPlatform.Application/Features/TrainingPlans/UpdateTrainingPlan/UpdateTrainingPlanEndpoint.cs`

- [ ] **Step 1: Add StartDate to UpdatePlanRequest.cs**

After `Weeks` (line 33), add:

```csharp
/// <summary>
/// Updated start date. Must be a Monday and not in the past.
/// Null clears the start date (only if it hasn't arrived and no weeks are published).
/// </summary>
public DateTime? StartDate { get; set; }
```

- [ ] **Step 2: Add start date validation to UpdatePlanEndpoint.cs**

After the `removedPublished` check (line 82), before `// Map request to domain`, add:

```csharp
// Start date validation
var today = DateOnly.FromDateTime(DateTime.UtcNow);

if (plan.StartDate.HasValue && req.StartDate?.Date != plan.StartDate.Value.Date)
{
    // Trying to change or clear an existing start date
    if (DateOnly.FromDateTime(plan.StartDate.Value) < today)
    {
        ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be changed after it has arrived.");
        return;
    }

    // Clearing: only allowed if no weeks are published
    if (!req.StartDate.HasValue && plan.Weeks.Any(w => w.Status == WeekStatus.Published))
    {
        ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be cleared when weeks are published.");
        return;
    }
}

if (req.StartDate.HasValue)
{
    if (req.StartDate.Value.DayOfWeek != System.DayOfWeek.Monday)
    {
        ThrowError(ErrorCodes.StartDateNotMonday, "Start date must be a Monday.");
        return;
    }

    if (DateOnly.FromDateTime(req.StartDate.Value) < today)
    {
        ThrowError(ErrorCodes.StartDateInPast, "Start date cannot be in the past.");
        return;
    }
}
```

Then in the mapping section (after line 85 `plan.Name = req.Name;`), add:

```csharp
plan.StartDate = req.StartDate?.Date;
```

- [ ] **Step 3: Add StartDate to UpdateTrainingPlanRequest.cs**

After `Weeks` (line 31), add:

```csharp
/// <summary>
/// Updated start date. Must be a Monday and not in the past.
/// </summary>
public DateTime? StartDate { get; set; }
```

- [ ] **Step 4: Add start date validation to UpdateTrainingPlanEndpoint.cs**

Same validation pattern as Step 2 — after the `removedPublished` check (line 80), add the same validation block. Then after `plan.Name = req.Name;` (line 83), add:

```csharp
plan.StartDate = req.StartDate?.Date;
```

- [ ] **Step 5: Build to verify**

Run: `dotnet build backend/FitnessPlatform.Application/`
Expected: BUILD SUCCEEDED

- [ ] **Step 6: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/NutritionPlans/UpdatePlan/ \
       backend/FitnessPlatform.Application/Features/TrainingPlans/UpdateTrainingPlan/
git commit -m "feat: add StartDate to update plan endpoints with lock/clear validation"
```

---

### Task 4: Backend — Update publish endpoints

**Files:**
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/PublishWeek/PublishWeekEndpoint.cs`
- Modify: `backend/FitnessPlatform.Application/Features/TrainingPlans/PublishTrainingWeek/PublishTrainingWeekEndpoint.cs`

- [ ] **Step 1: Add start date gate to PublishWeekEndpoint.cs**

After the `week.Status == WeekStatus.Published` check (line 72-76), add:

```csharp
// Start date must be set before publishing
if (!plan.StartDate.HasValue)
{
    ThrowError(ErrorCodes.StartDateRequired, "Start date must be set before publishing a week.");
    return;
}

// The target week's Monday must not be in the past
var weekStartDate = DateOnly.FromDateTime(plan.StartDate.Value.AddDays((req.WeekNumber - 1) * 7));
var today = DateOnly.FromDateTime(DateTime.UtcNow);
if (weekStartDate < today)
{
    ThrowError(ErrorCodes.WeekStartInPast, $"Week {req.WeekNumber} starts on {weekStartDate}, which is in the past.");
    return;
}
```

Also add `using FitnessPlatform.Application.Domain.Constants;` if not already imported (check — it's already imported on line 3).

- [ ] **Step 2: Add same gate to PublishTrainingWeekEndpoint.cs**

After the `week.Status == WeekStatus.Published` check (line 72-76), add the same block:

```csharp
// Start date must be set before publishing
if (!plan.StartDate.HasValue)
{
    ThrowError(ErrorCodes.StartDateRequired, "Start date must be set before publishing a week.");
    return;
}

// The target week's Monday must not be in the past
var weekStartDate = DateOnly.FromDateTime(plan.StartDate.Value.AddDays((req.WeekNumber - 1) * 7));
var today = DateOnly.FromDateTime(DateTime.UtcNow);
if (weekStartDate < today)
{
    ThrowError(ErrorCodes.WeekStartInPast, $"Week {req.WeekNumber} starts on {weekStartDate}, which is in the past.");
    return;
}
```

- [ ] **Step 3: Build to verify**

Run: `dotnet build backend/FitnessPlatform.Application/`
Expected: BUILD SUCCEEDED

- [ ] **Step 4: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/NutritionPlans/PublishWeek/ \
       backend/FitnessPlatform.Application/Features/TrainingPlans/PublishTrainingWeek/
git commit -m "feat: gate publishing on start date and week-start-in-past validation"
```

---

### Task 5: Backend — Update response DTOs

**Files:**
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/Shared/PlanSummaryDto.cs`
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/GetPlan/GetPlanResponse.cs`
- Modify: `backend/FitnessPlatform.Application/Features/TrainingPlans/Shared/TrainingPlanSummaryDto.cs`
- Modify: `backend/FitnessPlatform.Application/Features/TrainingPlans/GetTrainingPlan/GetTrainingPlanResponse.cs`
- Modify: `backend/FitnessPlatform.Application/Features/ClientTraining/GetTodaySession/GetTodaySessionResponse.cs`
- Modify: `backend/FitnessPlatform.Application/Features/ClientTraining/GetTodaySession/GetTodaySessionEndpoint.cs`

- [ ] **Step 1: Add StartDate to PlanSummaryDto.cs**

Add property after `DateUpdated` (line 49):

```csharp
/// <summary>
/// The Monday when Week 1 begins, if set.
/// </summary>
public DateTime? StartDate { get; set; }
```

In `FromDocument` (line 54-64), add:

```csharp
StartDate = plan.StartDate
```

- [ ] **Step 2: Add StartDate to GetPlanResponse.cs**

Add property after `DateUpdated` (line 58):

```csharp
/// <summary>
/// The Monday when Week 1 begins, if set.
/// </summary>
public DateTime? StartDate { get; set; }
```

In `FromDocument` (line 65-77), add:

```csharp
StartDate = plan.StartDate
```

- [ ] **Step 3: Add StartDate to TrainingPlanSummaryDto.cs**

Add property after `DateUpdated` (line 59):

```csharp
/// <summary>
/// The Monday when Week 1 begins, if set.
/// </summary>
public DateTime? StartDate { get; set; }
```

In `FromDocument` (line 58-69), add:

```csharp
StartDate = plan.StartDate
```

- [ ] **Step 4: Add StartDate to GetTrainingPlanResponse.cs**

Add property after `DateUpdated` (line 58):

```csharp
/// <summary>
/// The Monday when Week 1 begins, if set.
/// </summary>
public DateTime? StartDate { get; set; }
```

In `FromDocument` (line 63-75), add:

```csharp
StartDate = plan.StartDate
```

- [ ] **Step 5: Add TotalWeeks to GetTodaySessionResponse.cs**

After `CurrentWeek` (line 23), add:

```csharp
/// <summary>Total number of weeks in the plan.</summary>
public int? TotalWeeks { get; set; }
```

- [ ] **Step 6: Update GetTodaySessionEndpoint to use StartDate for week calculation**

Replace the current week calculation logic (lines 56-70) with:

```csharp
var publishedWeeks = plan.Weeks
    .Where(w => w.Status == WeekStatus.Published)
    .OrderBy(w => w.WeekNumber)
    .ToList();

if (publishedWeeks.Count == 0)
{
    await Send.OkAsync(new GetTodaySessionResponse { HasSession = false }, ct);
    return;
}

// Calculate current week using StartDate if available, otherwise fall back to DatePublished
int currentWeekNumber;
if (plan.StartDate.HasValue)
{
    var daysSinceStart = (int)(DateTime.UtcNow.Date - plan.StartDate.Value.Date).TotalDays;
    if (daysSinceStart < 0)
    {
        // Plan hasn't started yet
        await Send.OkAsync(new GetTodaySessionResponse { HasSession = false }, ct);
        return;
    }
    currentWeekNumber = (daysSinceStart / 7) + 1;
    // Clamp to valid range
    currentWeekNumber = Math.Max(1, Math.Min(currentWeekNumber, plan.Weeks.Count));
}
else
{
    // Legacy fallback: cycle through published weeks based on first publish date
    var firstPublished = publishedWeeks.First().DatePublished ?? plan.DateCreated;
    var daysSinceStart = (int)(DateTime.UtcNow.Date - firstPublished.Date).TotalDays;
    var currentWeekIndex = (daysSinceStart / 7) % publishedWeeks.Count;
    currentWeekNumber = publishedWeeks[Math.Max(0, currentWeekIndex)].WeekNumber;
}

var currentWeek = plan.Weeks.FirstOrDefault(w => w.WeekNumber == currentWeekNumber);
if (currentWeek is null || currentWeek.Status != WeekStatus.Published)
{
    // The calculated week isn't published yet — find the nearest published week
    currentWeek = publishedWeeks.Last();
}
```

Then update the response mapping (line 81-88) to include `TotalWeeks`:

```csharp
await Send.OkAsync(new GetTodaySessionResponse
{
    HasSession = todaySession is not null,
    PlanId = plan.ExternalId,
    PlanName = plan.Name,
    Session = todaySession,
    CurrentWeek = currentWeek.WeekNumber,
    TotalWeeks = plan.Weeks.Count
}, ct);
```

- [ ] **Step 7: Build to verify**

Run: `dotnet build backend/FitnessPlatform.Application/`
Expected: BUILD SUCCEEDED

- [ ] **Step 8: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/NutritionPlans/Shared/ \
       backend/FitnessPlatform.Application/Features/NutritionPlans/GetPlan/ \
       backend/FitnessPlatform.Application/Features/TrainingPlans/Shared/ \
       backend/FitnessPlatform.Application/Features/TrainingPlans/GetTrainingPlan/ \
       backend/FitnessPlatform.Application/Features/ClientTraining/
git commit -m "feat: add StartDate to all plan response DTOs and use it for week calculation"
```

---

### Task 6: Backend — Run tests

**Files:**
- Test: `backend/FitnessPlatform.Tests/`

- [ ] **Step 1: Run all tests**

Run: `dotnet test backend/FitnessPlatform.Tests/`
Expected: All tests pass. Fix any compilation or test failures before proceeding.

- [ ] **Step 2: Commit any test fixes if needed**

---

### Task 7: Web — Update TypeScript types and API layer

**Files:**
- Modify: `web/src/api/plan-types.ts`
- Modify: `web/src/api/training-plan-types.ts`

- [ ] **Step 1: Add startDate to nutrition plan types**

In `NutritionPlanDetail` (line 60-71), add after `dateUpdated`:

```typescript
startDate?: string | null;
```

In `PlanSummary` (line 73-83), add after `dateUpdated`:

```typescript
startDate?: string | null;
```

In `CreatePlanRequest` (line 93-99), add after `weekCount`:

```typescript
startDate?: string | null;
```

In `UpdatePlanRequest` (line 101-107), add after `version`:

```typescript
startDate?: string | null;
```

- [ ] **Step 2: Add startDate to training plan types**

In `TrainingPlanDetail` (line 43-55), add after `dateUpdated`:

```typescript
startDate?: string | null;
```

In `TrainingPlanSummary` (line 57-68), add after `dateUpdated`:

```typescript
startDate?: string | null;
```

In `CreateTrainingPlanRequest` (line 78-84), add after `weekCount`:

```typescript
startDate?: string | null;
```

In `UpdateTrainingPlanRequest` (line 86-92), add after `version`:

```typescript
startDate?: string | null;
```

- [ ] **Step 3: Commit**

```bash
git add web/src/api/plan-types.ts web/src/api/training-plan-types.ts
git commit -m "feat: add startDate to web TypeScript plan types"
```

---

### Task 8: Web — Update stores to include startDate in save payloads

**Files:**
- Modify: `web/src/stores/nutritionPlan.ts`
- Modify: `web/src/stores/trainingPlan.ts`

- [ ] **Step 1: Add startDate to nutrition plan save payload**

In `nutritionPlan.ts`, in the `save` function (line 460), add `startDate` to the request object after `version`:

```typescript
const request: UpdatePlanRequest = {
  name: plan.name,
  globalSettings: plan.globalSettings,
  version: plan.version,
  startDate: plan.startDate,
  weeks: plan.weeks.map((week) => ({
```

- [ ] **Step 2: Add startDate to training plan save payload**

In `trainingPlan.ts`, in the `save` function (line 610), add `startDate` to the request object after `version`:

```typescript
const request: UpdateTrainingPlanRequest = {
  name: plan.name,
  description: plan.description,
  version: plan.version,
  startDate: plan.startDate,
  weeks: plan.weeks.map((w) => ({
```

- [ ] **Step 3: Add setStartDate mutation to nutrition plan store**

In the `NutritionPlanState` interface, add:

```typescript
setStartDate: (date: string | null) => void;
```

Implement it in the store:

```typescript
setStartDate: (date) => {
  const { plan } = get();
  if (!plan) return;
  set({ plan: { ...plan, startDate: date }, isDirty: true });
},
```

- [ ] **Step 4: Add setStartDate mutation to training plan store**

In the `TrainingPlanState` interface, add:

```typescript
setStartDate: (date: string | null) => void;
```

Implement it in the store:

```typescript
setStartDate: (date) => {
  const { plan } = get();
  if (!plan) return;
  set({ plan: { ...plan, startDate: date }, isDirty: true });
},
```

- [ ] **Step 5: Commit**

```bash
git add web/src/stores/nutritionPlan.ts web/src/stores/trainingPlan.ts
git commit -m "feat: add startDate to plan stores and save payloads"
```

---

### Task 9: Web — Add i18n keys and error code translations

**Files:**
- Modify: `web/src/i18n/locales/en.json`
- Modify: `web/src/i18n/locales/cs.json`
- Modify: `web/src/i18n/locales/de.json`

- [ ] **Step 1: Add i18n keys to en.json**

In the `nutrition` section (before the closing `}` at line 442), add:

```json
"startDate": "Start Date",
"startDateHint": "Must be a Monday",
"startDateLocked": "Start date is locked",
"startDateRequired": "Set a start date before publishing",
"weekDateRange": "{{start}} – {{end}}"
```

In the `training` section (before the closing `}` at line 566), add:

```json
"startDate": "Start Date",
"startDateHint": "Must be a Monday",
"startDateLocked": "Start date is locked",
"startDateRequired": "Set a start date before publishing",
"weekDateRange": "{{start}} – {{end}}"
```

In the `apiErrors` section (after `PLAN_NOT_DRAFT` at line 460), add:

```json
"START_DATE_NOT_MONDAY": "Start date must be a Monday.",
"START_DATE_IN_PAST": "Start date cannot be in the past.",
"START_DATE_LOCKED": "Start date cannot be changed after it has arrived.",
"START_DATE_REQUIRED": "Set a start date before publishing a week.",
"WEEK_START_IN_PAST": "This week's start date is in the past and cannot be published."
```

- [ ] **Step 2: Add translations to cs.json**

Same keys with Czech translations:

```json
"startDate": "Datum zahájení",
"startDateHint": "Musí být pondělí",
"startDateLocked": "Datum zahájení je uzamčeno",
"startDateRequired": "Nastavte datum zahájení před publikováním",
"weekDateRange": "{{start}} – {{end}}"
```

API errors:

```json
"START_DATE_NOT_MONDAY": "Datum zahájení musí být pondělí.",
"START_DATE_IN_PAST": "Datum zahájení nemůže být v minulosti.",
"START_DATE_LOCKED": "Datum zahájení nelze změnit poté, co nastalo.",
"START_DATE_REQUIRED": "Před publikováním týdne nastavte datum zahájení.",
"WEEK_START_IN_PAST": "Datum zahájení tohoto týdne je v minulosti a nelze jej publikovat."
```

- [ ] **Step 3: Add translations to de.json**

Same keys with German translations:

```json
"startDate": "Startdatum",
"startDateHint": "Muss ein Montag sein",
"startDateLocked": "Startdatum ist gesperrt",
"startDateRequired": "Legen Sie ein Startdatum fest, bevor Sie veröffentlichen",
"weekDateRange": "{{start}} – {{end}}"
```

API errors:

```json
"START_DATE_NOT_MONDAY": "Das Startdatum muss ein Montag sein.",
"START_DATE_IN_PAST": "Das Startdatum darf nicht in der Vergangenheit liegen.",
"START_DATE_LOCKED": "Das Startdatum kann nicht mehr geändert werden, nachdem es erreicht wurde.",
"START_DATE_REQUIRED": "Legen Sie ein Startdatum fest, bevor Sie eine Woche veröffentlichen.",
"WEEK_START_IN_PAST": "Das Startdatum dieser Woche liegt in der Vergangenheit und kann nicht veröffentlicht werden."
```

- [ ] **Step 4: Commit**

```bash
git add web/src/i18n/locales/
git commit -m "feat: add start date i18n keys for en, cs, de"
```

---

### Task 10: Web — Add date picker to create plan drawers

**Files:**
- Modify: `web/src/pages/PlansPage.tsx`
- Modify: `web/src/pages/TrainingPlansPage.tsx`

- [ ] **Step 1: Add start date field to PlansPage create drawer**

In the `openDrawer` callback (line 43), update the reset state to include `startDate`:

```typescript
setNewPlan({ clientId: clientIdParam ?? '', name: '', weekCount: 1, startDate: null });
```

After the week count field in the form (after line 287 `</div>`), add:

```tsx
<div>
  <label className="mb-1 block font-heading text-xs text-text3">
    {t('nutrition.startDate')}
  </label>
  <input
    type="date"
    value={newPlan.startDate ?? ''}
    onChange={(e) => {
      const val = e.target.value || null;
      setNewPlan({ ...newPlan, startDate: val });
    }}
    step="7"
    className={`w-full ${inputClass}`}
  />
  <p className="mt-1 text-[10px] text-text3">{t('nutrition.startDateHint')}</p>
</div>
```

Note: The `step="7"` attribute hints to the browser to step by weeks. We additionally need to validate Monday on change. Update the `onChange`:

```typescript
onChange={(e) => {
  const val = e.target.value || null;
  if (val) {
    const d = new Date(val + 'T00:00:00');
    if (d.getDay() !== 1) return; // Only allow Mondays
  }
  setNewPlan({ ...newPlan, startDate: val });
}}
```

- [ ] **Step 2: Add start date field to TrainingPlansPage create drawer**

Same pattern. Update the `openDrawer` reset to include `startDate: null`. After the description field in the form (after line 297 `</div>`), add the same date picker block but using `t('training.startDate')` and `t('training.startDateHint')`.

- [ ] **Step 3: Include startDate in create API call payloads**

In PlansPage `handleCreate` (line 88), the `newPlan` state already includes `startDate` and is passed to `createPlan(newPlan)`, so this works automatically.

Same for TrainingPlansPage.

- [ ] **Step 4: Verify web dev server compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/PlansPage.tsx web/src/pages/TrainingPlansPage.tsx
git commit -m "feat: add start date picker to plan create drawers"
```

---

### Task 11: Web — Add inline start date to plan detail pages

**Files:**
- Modify: `web/src/components/nutrition/PlanToolbar.tsx`
- Modify: `web/src/pages/NutritionPlanPage.tsx`
- Modify: `web/src/pages/TrainingPlanPage.tsx`

- [ ] **Step 1: Add startDate to PlanToolbar**

Add props:

```typescript
interface PlanToolbarProps {
  planName: string;
  isDirty: boolean;
  isSaving: boolean;
  activeTab: 'mealPlan' | 'nutritionGoals';
  onTabChange: (tab: 'mealPlan' | 'nutritionGoals') => void;
  onSave: () => void;
  startDate?: string | null;
  onStartDateChange?: (date: string | null) => void;
  isStartDateLocked?: boolean;
}
```

In the top bar (line 33-55), after `<h1>` and before the save controls div, add:

```tsx
{onStartDateChange && (
  <div className="flex items-center gap-2">
    <label className="font-heading text-[10px] font-semibold uppercase tracking-wide text-text3">
      {t('nutrition.startDate')}
    </label>
    <input
      type="date"
      value={startDate ?? ''}
      onChange={(e) => {
        const val = e.target.value || null;
        if (val) {
          const d = new Date(val + 'T00:00:00');
          if (d.getDay() !== 1) return;
        }
        onStartDateChange(val);
      }}
      disabled={isStartDateLocked}
      className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text outline-none transition-colors focus:border-gold/40 disabled:opacity-40 disabled:cursor-not-allowed"
    />
  </div>
)}
```

- [ ] **Step 2: Wire up in NutritionPlanPage.tsx**

In the component, pull `setStartDate` from the store:

```typescript
const { plan, isDirty, isSaving, selectedWeek, setSelectedWeek, addWeek, removeWeek, save, publishWeek: storePublishWeek, setStartDate } = useNutritionPlanStore();
```

Compute `isStartDateLocked`:

```typescript
const isStartDateLocked = Boolean(
  plan?.startDate && new Date(plan.startDate + 'T00:00:00') < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
);
```

Pass to PlanToolbar:

```tsx
<PlanToolbar
  planName={plan.name}
  isDirty={isDirty}
  isSaving={isSaving}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  onSave={handleSave}
  startDate={plan.startDate}
  onStartDateChange={setStartDate}
  isStartDateLocked={isStartDateLocked}
/>
```

- [ ] **Step 3: Add inline start date to TrainingPlanPage toolbar**

In the TrainingPlanPage toolbar section (lines 239-266), after the plan name `<h1>` (line 240-244) and before the unsaved badge, add:

```tsx
<div className="flex items-center gap-2">
  <label className="font-heading text-[10px] font-semibold uppercase tracking-wide text-text3">
    {t('training.startDate')}
  </label>
  <input
    type="date"
    value={plan.startDate ?? ''}
    onChange={(e) => {
      const val = e.target.value || null;
      if (val) {
        const d = new Date(val + 'T00:00:00');
        if (d.getDay() !== 1) return;
      }
      setStartDate(val);
    }}
    disabled={Boolean(plan.startDate && new Date(plan.startDate + 'T00:00:00') < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00'))}
    className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text outline-none transition-colors focus:border-gold/40 disabled:opacity-40 disabled:cursor-not-allowed"
  />
</div>
```

Pull `setStartDate` from the training plan store.

- [ ] **Step 4: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/src/components/nutrition/PlanToolbar.tsx \
       web/src/pages/NutritionPlanPage.tsx \
       web/src/pages/TrainingPlanPage.tsx
git commit -m "feat: add inline start date picker to plan detail pages"
```

---

### Task 12: Web — Update WeekSelector to show date ranges

**Files:**
- Modify: `web/src/components/nutrition/WeekSelector.tsx`

- [ ] **Step 1: Add startDate prop to WeekSelector**

Add to `WeekSelectorProps` interface:

```typescript
/// Optional plan start date (ISO date string). When set, date ranges are shown alongside week labels.
startDate?: string | null;
```

- [ ] **Step 2: Compute and display date ranges**

Inside the component, add a helper to format the date range:

```typescript
const formatWeekRange = (weekNumber: number) => {
  if (!startDate) return null;
  const start = new Date(startDate + 'T00:00:00');
  start.setDate(start.getDate() + (weekNumber - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
};
```

In the default tab button (lines 82-96), after the week label `<span>` (line 90), add:

```tsx
{formatWeekRange(weekNumber) && (
  <span className="text-[9px] text-text3 normal-case tracking-normal">
    {formatWeekRange(weekNumber)}
  </span>
)}
```

- [ ] **Step 3: Pass startDate from both plan pages**

In NutritionPlanPage where `<WeekSelector>` is rendered (line 390-398), add:

```tsx
startDate={plan.startDate}
```

In TrainingPlanPage where `<WeekSelector>` is rendered (line 269-277), add:

```tsx
startDate={plan.startDate}
```

- [ ] **Step 4: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/src/components/nutrition/WeekSelector.tsx \
       web/src/pages/NutritionPlanPage.tsx \
       web/src/pages/TrainingPlanPage.tsx
git commit -m "feat: show date ranges in WeekSelector when start date is set"
```

---

### Task 13: Mobile — Update types and week display

**Files:**
- Modify: `mobile/src/api/training.ts`
- Modify: `mobile/app/(client)/training/index.tsx`
- Modify: `mobile/src/i18n/locales/en.json`

- [ ] **Step 1: Update TodayTrainingResponse type**

In `mobile/src/api/training.ts`, add to `TodayTrainingResponse` (line 33-39):

```typescript
totalWeeks?: number | null;
```

- [ ] **Step 2: Update mobile training index to show week progress**

In `mobile/app/(client)/training/index.tsx`, update the card header area (lines 29-34) to show the current week / total weeks:

After the `cardMeta` text (line 32-33), add a week indicator:

```tsx
{data.currentWeek != null && data.totalWeeks != null && (
  <Text style={styles.weekBadge}>
    {t('training.title')} · Week {data.currentWeek}/{data.totalWeeks}
  </Text>
)}
```

Add the style:

```typescript
weekBadge: { fontSize: 11, color: Colors.dark.gold, marginTop: 4, fontWeight: '600' },
```

- [ ] **Step 3: Add i18n keys to mobile en.json**

In the `training` section of `mobile/src/i18n/locales/en.json`, add:

```json
"weekProgress": "Week {{current}}/{{total}}"
```

Then use `t('training.weekProgress', { current: data.currentWeek, total: data.totalWeeks })` instead of the hardcoded string.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/api/training.ts \
       mobile/app/\(client\)/training/index.tsx \
       mobile/src/i18n/locales/en.json
git commit -m "feat: show week progress on mobile training screen"
```

---

### Task 14: Final build verification

- [ ] **Step 1: Backend build**

Run: `dotnet build backend/FitnessPlatform.Application/`
Expected: BUILD SUCCEEDED

- [ ] **Step 2: Backend tests**

Run: `dotnet test backend/FitnessPlatform.Tests/`
Expected: All pass

- [ ] **Step 3: Web TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Final commit if any fixups needed**
