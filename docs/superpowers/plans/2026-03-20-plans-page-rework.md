# Plans Page Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the nutrition plan editor to use a single full-state save, per-week publish, two tabs (Meal Plan + read-only Nutrition Goals), and distribution-based meal sections with calorie warnings.

**Architecture:** Backend switches from granular endpoints to a single PUT that accepts the full plan. PlanWeek gets per-week Draft/Published status. Frontend Zustand store becomes local-only mutations with explicit Save. The plan page adds tabs for the editor and a read-only nutrition goals reference view.

**Tech Stack:** ASP.NET Core 10 + FastEndpoints + MongoDB (backend), React + TypeScript + Zustand + Tailwind CSS (frontend)

**Spec:** `docs/superpowers/specs/2026-03-20-plans-page-rework-design.md`

---

## File Map

### Backend — Create
| File | Responsibility |
|------|---------------|
| `Features/NutritionPlans/UpdatePlan/UpdateWeekRequest.cs` | Week/Day/Meal/Food nested DTOs for full-state update |
| `Features/NutritionPlans/PublishWeek/PublishWeekEndpoint.cs` | Per-week publish endpoint |
| `Features/NutritionPlans/PublishWeek/PublishWeekRequest.cs` | Request DTO for week publish |
| `Domain/Enums/WeekStatus.cs` | Draft/Published enum |

### Backend — Modify
| File | Change |
|------|--------|
| `Domain/Documents/PlanWeek.cs` | Add Status and DatePublished fields |
| `Domain/Documents/NutritionPlan.cs` | Remove DatePublished field |
| `Features/NutritionPlans/UpdatePlan/UpdatePlanEndpoint.cs` | Full-state replace logic |
| `Features/NutritionPlans/UpdatePlan/UpdatePlanRequest.cs` | Add Weeks list to request |
| `Features/NutritionPlans/UpdatePlan/UpdatePlanValidator.cs` | Validate nested weeks/days/meals/foods |
| `Features/NutritionPlans/GetPlan/GetPlanResponse.cs` | Remove plan-level DatePublished |
| `Features/NutritionPlans/GetPlans/GetPlansEndpoint.cs` | Derive status from week statuses |
| `Features/NutritionPlans/Shared/PlanSummaryDto.cs` | Derive status from week statuses |
| `Features/NutritionPlans/CreatePlan/CreatePlanEndpoint.cs` | Init weeks with WeekStatus.Draft |

### Backend — Delete
| File | Reason |
|------|--------|
| `Features/NutritionPlans/AddMeal/` (entire folder) | Replaced by full-state PUT |
| `Features/NutritionPlans/DeleteMeal/` (entire folder) | Replaced by full-state PUT |
| `Features/NutritionPlans/AddFoodToMeal/` (entire folder) | Replaced by full-state PUT |
| `Features/NutritionPlans/RemoveFoodFromMeal/` (entire folder) | Replaced by full-state PUT |
| `Features/NutritionPlans/UpdateDay/` (entire folder) | Replaced by full-state PUT |
| `Features/NutritionPlans/UpdateMeal/` (entire folder) | Replaced by full-state PUT |
| `Features/NutritionPlans/PublishPlan/` (entire folder) | Replaced by per-week publish |
| `Features/NutritionPlans/DuplicatePlan/` (entire folder) | Feature removed |

### Backend Tests — Create
| File | Responsibility |
|------|---------------|
| `Endpoints/NutritionPlans/UpdatePlanFullStateTests.cs` | Tests for new full-state PUT |
| `Endpoints/NutritionPlans/PublishWeekEndpointTests.cs` | Tests for per-week publish |

### Backend Tests — Delete
| File | Reason |
|------|--------|
| `Endpoints/NutritionPlans/AddMealEndpointTests.cs` | Endpoint removed |
| `Endpoints/NutritionPlans/DeleteMealEndpointTests.cs` | Endpoint removed |
| `Endpoints/NutritionPlans/AddFoodToMealEndpointTests.cs` | Endpoint removed |
| `Endpoints/NutritionPlans/RemoveFoodFromMealEndpointTests.cs` | Endpoint removed |
| `Endpoints/NutritionPlans/DuplicatePlanEndpointTests.cs` | Endpoint removed |
| `Endpoints/NutritionPlans/PublishPlanEndpointTests.cs` | Replaced by PublishWeekEndpointTests |

### Frontend — Create
| File | Responsibility |
|------|---------------|
| `components/nutrition/WeekSelector.tsx` | Week tabs with status badges, publish/add/remove buttons |
| `components/nutrition/NutritionGoalsTab.tsx` | Read-only nutrition goals display |

### Frontend — Modify
| File | Change |
|------|--------|
| `api/plan-types.ts` | Add WeekStatus to PlanWeek, new UpdatePlanRequest with weeks |
| `api/plans.ts` | Replace granular endpoints with full-state update + publishWeek |
| `stores/nutritionPlan.ts` | Remove API calls from mutations, add save() and publishWeek() |
| `pages/NutritionPlanPage.tsx` | Add tabs, remove auto-save, add Save button |
| `pages/PlansPage.tsx` | Remove duplicate button |
| `components/nutrition/PlanToolbar.tsx` | Remove week selector (moved out), add tabs |
| `components/nutrition/DayColumn.tsx` | Add day totals, meal distribution targets, calorie warnings |
| `components/nutrition/MealCard.tsx` | Add calorie target display and over-target warning |
| `i18n/locales/en.json` | New keys for tabs, week status, save, warnings |
| `i18n/locales/cs.json` | Czech translations |
| `i18n/locales/de.json` | German translations |

---

## Task 1: Backend — Add WeekStatus enum and update PlanWeek

**Files:**
- Create: `backend/FitnessPlatform.Application/Domain/Enums/WeekStatus.cs`
- Modify: `backend/FitnessPlatform.Application/Domain/Documents/PlanWeek.cs`
- Modify: `backend/FitnessPlatform.Application/Domain/Documents/NutritionPlan.cs`

- [ ] **Step 1: Create WeekStatus enum**

```csharp
// Domain/Enums/WeekStatus.cs
namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Publish status of a single week within a nutrition plan.
/// </summary>
public enum WeekStatus
{
    /// <summary>Week is being edited, not yet visible to client.</summary>
    Draft,
    /// <summary>Week is published and visible to client.</summary>
    Published
}
```

- [ ] **Step 2: Add Status and DatePublished to PlanWeek**

In `Domain/Documents/PlanWeek.cs`, add:
```csharp
using FitnessPlatform.Application.Domain.Enums;
// ... existing using

/// <summary>
/// Publish status of this week (Draft or Published).
/// </summary>
[BsonElement("status")]
[BsonRepresentation(BsonType.String)]
public WeekStatus Status { get; set; } = WeekStatus.Draft;

/// <summary>
/// When this week was published to the client.
/// </summary>
[BsonElement("datePublished")]
public DateTime? DatePublished { get; set; }
```

Also add `using MongoDB.Bson;` for `BsonType`.

- [ ] **Step 3: Remove DatePublished from NutritionPlan document**

In `Domain/Documents/NutritionPlan.cs`, remove the `DatePublished` property and its XML doc comment (lines 80-84).

- [ ] **Step 4: Update GetPlanResponse to remove plan-level DatePublished**

In `Features/NutritionPlans/GetPlan/GetPlanResponse.cs`:
- Remove the `DatePublished` property
- Remove `DatePublished = plan.DatePublished` from the `FromDocument` mapping

- [ ] **Step 5: Update PlanSummaryDto to derive status from weeks**

In `Features/NutritionPlans/Shared/PlanSummaryDto.cs`, change the `Status` mapping in `FromDocument`:
```csharp
Status = plan.Status.ToString(),
```
Keep this as-is — the plan-level `Status` is stored in MongoDB and recomputed during each update/publish. For existing plans that predate this change, the stored `Status` will be correct after their first save or publish.

- [ ] **Step 6: Update CreatePlanEndpoint to init weeks with WeekStatus.Draft**

In `Features/NutritionPlans/CreatePlan/CreatePlanEndpoint.cs`, in the section where weeks are created, add `Status = WeekStatus.Draft` to each `PlanWeek` initialization. Add `using FitnessPlatform.Application.Domain.Enums;`.

- [ ] **Step 7: Update PlanTestHelpers to include WeekStatus**

In `backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/PlanTestHelpers.cs`, update the `CreatePlan` method to set `Status = WeekStatus.Draft` on each week:
```csharp
Weeks = Enumerable.Range(1, weekCount).Select(w => new PlanWeek
{
    WeekNumber = w,
    Status = WeekStatus.Draft,
    Days = Enumerable.Range(1, 7).Select(d => new PlanDay
    {
        DayOfWeek = d,
        Meals = []
    }).ToList()
}).ToList(),
```
Add `using FitnessPlatform.Application.Domain.Enums;`.

- [ ] **Step 8: Build and verify**

Run: `cd backend/FitnessPlatform.Application && dotnet build`
Expected: Build succeeds.

Run: `cd backend && dotnet test`
Expected: Existing tests pass (PlanWeek changes are backward compatible — new fields have defaults).

- [ ] **Step 9: Commit**

```bash
git add backend/FitnessPlatform.Application/Domain/Enums/WeekStatus.cs \
  backend/FitnessPlatform.Application/Domain/Documents/PlanWeek.cs \
  backend/FitnessPlatform.Application/Domain/Documents/NutritionPlan.cs \
  backend/FitnessPlatform.Application/Features/NutritionPlans/GetPlan/GetPlanResponse.cs \
  backend/FitnessPlatform.Application/Features/NutritionPlans/Shared/PlanSummaryDto.cs \
  backend/FitnessPlatform.Application/Features/NutritionPlans/CreatePlan/CreatePlanEndpoint.cs \
  backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/PlanTestHelpers.cs
git commit -m "feat(backend): add per-week Draft/Published status to PlanWeek"
```

---

## Task 2: Backend — Rework UpdatePlan endpoint to full-state save

**Files:**
- Create: `backend/FitnessPlatform.Application/Features/NutritionPlans/UpdatePlan/UpdateWeekRequest.cs`
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/UpdatePlan/UpdatePlanRequest.cs`
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/UpdatePlan/UpdatePlanValidator.cs`
- Modify: `backend/FitnessPlatform.Application/Features/NutritionPlans/UpdatePlan/UpdatePlanEndpoint.cs`

- [ ] **Step 1: Create nested request DTOs**

Create `Features/NutritionPlans/UpdatePlan/UpdateWeekRequest.cs`:
```csharp
using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// A week in the full-state plan update request.
/// </summary>
public class UpdateWeekRequest
{
    /// <summary>Week number (1-based).</summary>
    public int WeekNumber { get; set; }

    /// <summary>Days in this week.</summary>
    public List<UpdateDayRequest> Days { get; set; } = [];
}

/// <summary>
/// A day in the full-state plan update request.
/// </summary>
public class UpdateDayRequest
{
    /// <summary>Day of week (1=Monday, 7=Sunday).</summary>
    public int DayOfWeek { get; set; }

    /// <summary>Meals for this day.</summary>
    public List<UpdateMealRequest> Meals { get; set; } = [];
}

/// <summary>
/// A meal in the full-state plan update request.
/// </summary>
public class UpdateMealRequest
{
    /// <summary>Meal ID. Null for newly created meals (backend generates Guid).</summary>
    public Guid? MealId { get; set; }

    /// <summary>Display name of the meal.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Display order within the day (1-based).</summary>
    public int Order { get; set; }

    /// <summary>Foods in this meal, ordered by list position.</summary>
    public List<UpdateMealFoodRequest> Foods { get; set; } = [];
}

/// <summary>
/// A food item in the full-state plan update request. Includes denormalized nutrient data.
/// </summary>
public class UpdateMealFoodRequest
{
    /// <summary>Reference to the food document's ExternalId.</summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>Snapshot of the food name.</summary>
    public string FoodName { get; set; } = string.Empty;

    /// <summary>Nutrient values per 100 grams (denormalized snapshot).</summary>
    public NutrientValue NutrientValuePer100Grams { get; set; } = new();

    /// <summary>Amount in grams.</summary>
    public decimal AmountGrams { get; set; }
}
```

- [ ] **Step 2: Update UpdatePlanRequest to include Weeks**

Replace `Features/NutritionPlans/UpdatePlan/UpdatePlanRequest.cs`:
```csharp
using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Request to update a nutrition plan with full state (name, settings, all weeks/days/meals/foods).
/// </summary>
public class UpdatePlanRequest
{
    /// <summary>Plan identifier (from route).</summary>
    public Guid PlanId { get; set; }

    /// <summary>Display name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Global daily nutrition targets.</summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>All weeks with their days, meals, and foods.</summary>
    public List<UpdateWeekRequest> Weeks { get; set; } = [];

    /// <summary>Optimistic concurrency version.</summary>
    public int Version { get; set; }
}
```

- [ ] **Step 3: Update validator for nested structure**

Replace `Features/NutritionPlans/UpdatePlan/UpdatePlanValidator.cs`:
```csharp
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Validates the full-state plan update request.
/// </summary>
public class UpdatePlanValidator : Validator<UpdatePlanRequest>
{
    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public UpdatePlanValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Version).GreaterThanOrEqualTo(1);
        RuleFor(x => x.Weeks).NotEmpty()
            .Must(w => w.Count <= 52).WithMessage("Maximum 52 weeks allowed.");
        RuleFor(x => x.Weeks)
            .Must(w => w.Select(wk => wk.WeekNumber).Distinct().Count() == w.Count)
            .WithMessage("Duplicate week numbers are not allowed.");

        RuleForEach(x => x.Weeks).ChildRules(week =>
        {
            week.RuleFor(w => w.WeekNumber).GreaterThanOrEqualTo(1);
            week.RuleFor(w => w.Days)
                .Must(d => d.Select(dd => dd.DayOfWeek).Distinct().Count() == d.Count)
                .WithMessage("Duplicate days of week are not allowed within a week.");
            week.RuleForEach(w => w.Days).ChildRules(day =>
            {
                day.RuleFor(d => d.DayOfWeek).InclusiveBetween(1, 7);
                day.RuleFor(d => d.Meals).Must(m => m.Count <= 20)
                    .WithMessage("Maximum 20 meals per day.");
                day.RuleFor(d => d.Meals)
                    .Must(m => m.Where(mm => mm.MealId.HasValue)
                               .Select(mm => mm.MealId!.Value)
                               .Distinct().Count() == m.Count(mm => mm.MealId.HasValue))
                    .WithMessage("Duplicate MealId values are not allowed within a day.");
                day.RuleForEach(d => d.Meals).ChildRules(meal =>
                {
                    meal.RuleFor(m => m.Name).NotEmpty().MaximumLength(100);
                    meal.RuleFor(m => m.Order).GreaterThanOrEqualTo(1);
                    meal.RuleFor(m => m.Foods).Must(f => f.Count <= 50)
                        .WithMessage("Maximum 50 foods per meal.");
                    meal.RuleForEach(m => m.Foods).ChildRules(food =>
                    {
                        food.RuleFor(f => f.FoodExternalId).NotEmpty();
                        food.RuleFor(f => f.FoodName).NotEmpty();
                        food.RuleFor(f => f.AmountGrams).GreaterThan(0).LessThanOrEqualTo(10000);
                    });
                });
            });
        });
    }
}
```

- [ ] **Step 4: Rewrite UpdatePlanEndpoint for full-state replace**

Replace `Features/NutritionPlans/UpdatePlan/UpdatePlanEndpoint.cs`:
```csharp
using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Full-state update of a nutrition plan: replaces name, settings, and all weeks/days/meals/foods.
/// Preserves per-week Status and DatePublished. Uses optimistic concurrency.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Service to recalculate nutrient totals.</param>
public class UpdatePlanEndpoint(IMongoContext mongo, IMacroCalculatorService macroCalculator)
    : Endpoint<UpdatePlanRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/nutrition/plans/{PlanId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Full-state update of a nutrition plan";
            s.Description = "Replaces the plan's name, global settings, and all weeks/days/meals/foods. " +
                            "Per-week publish status is preserved. Uses optimistic concurrency via version field.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdatePlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Fetch current plan
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Optimistic concurrency check
        if (plan.Version != req.Version)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict. The plan was modified by another request." },
                409, cancellation: ct);
            return;
        }

        // Build lookup of existing week statuses
        var existingWeeks = plan.Weeks.ToDictionary(w => w.WeekNumber);

        // Check that no published weeks are being removed
        var incomingWeekNumbers = req.Weeks.Select(w => w.WeekNumber).ToHashSet();
        var removedPublished = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published && !incomingWeekNumbers.Contains(w.WeekNumber))
            .ToList();

        if (removedPublished.Count > 0)
        {
            ThrowError($"Cannot remove published weeks: {string.Join(", ", removedPublished.Select(w => w.WeekNumber))}");
            return;
        }

        // Map request to domain
        plan.Name = req.Name;
        plan.GlobalSettings = req.GlobalSettings;
        plan.Weeks = req.Weeks.Select(rw =>
        {
            var existing = existingWeeks.GetValueOrDefault(rw.WeekNumber);
            return new PlanWeek
            {
                WeekNumber = rw.WeekNumber,
                Status = existing?.Status ?? WeekStatus.Draft,
                DatePublished = existing?.DatePublished,
                Days = rw.Days.Select(rd => new PlanDay
                {
                    DayOfWeek = rd.DayOfWeek,
                    Meals = rd.Meals.Select(rm => new PlanMeal
                    {
                        MealId = rm.MealId ?? Guid.NewGuid(),
                        Name = rm.Name,
                        Order = rm.Order,
                        Foods = rm.Foods.Select(rf => new MealFood
                        {
                            FoodExternalId = rf.FoodExternalId,
                            FoodName = rf.FoodName,
                            NutrientValuePer100Grams = rf.NutrientValuePer100Grams,
                            AmountGrams = rf.AmountGrams
                        }).ToList()
                    }).ToList()
                }).ToList()
            };
        }).ToList();

        // Recalculate totals
        macroCalculator.RecalculateTotals(plan);

        // Derive plan-level status from week statuses
        plan.Status = plan.Weeks.Any(w => w.Status == WeekStatus.Published)
            ? NutritionPlanStatus.Active
            : NutritionPlanStatus.Draft;

        plan.DateUpdated = DateTime.UtcNow;
        plan.Version += 1;

        // Persist with version check
        var versionFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.NutritionPlans.ReplaceOneAsync(
            versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict. The plan was modified by another request." },
                409, cancellation: ct);
            return;
        }

        await Send.OkAsync(GetPlanResponse.FromDocument(plan), ct);
    }
}
```

- [ ] **Step 5: Build and verify**

Run: `cd backend/FitnessPlatform.Application && dotnet build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/NutritionPlans/UpdatePlan/
git commit -m "feat(backend): rework UpdatePlan to full-state save with nested weeks/days/meals/foods"
```

---

## Task 3: Backend — Add PublishWeek endpoint

**Files:**
- Create: `backend/FitnessPlatform.Application/Features/NutritionPlans/PublishWeek/PublishWeekRequest.cs`
- Create: `backend/FitnessPlatform.Application/Features/NutritionPlans/PublishWeek/PublishWeekEndpoint.cs`

- [ ] **Step 1: Create PublishWeekRequest**

```csharp
// Features/NutritionPlans/PublishWeek/PublishWeekRequest.cs
namespace FitnessPlatform.Application.Features.NutritionPlans.PublishWeek;

/// <summary>
/// Request to publish a specific week of a nutrition plan.
/// </summary>
public class PublishWeekRequest
{
    /// <summary>Plan identifier.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Week number to publish.</summary>
    public int WeekNumber { get; set; }

    /// <summary>Optimistic concurrency version.</summary>
    public int Version { get; set; }
}
```

- [ ] **Step 2: Create PublishWeekEndpoint**

```csharp
// Features/NutritionPlans/PublishWeek/PublishWeekEndpoint.cs
using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.PublishWeek;

/// <summary>
/// Publishes a single week of a nutrition plan, making it visible to the client.
/// Archives other active plans for the same client when the first week is published.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class PublishWeekEndpoint(IMongoContext mongo) : Endpoint<PublishWeekRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plans/{PlanId}/weeks/{WeekNumber}/publish");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Publish a week of a nutrition plan";
            s.Description = "Sets the week's status to Published. Archives other active plans for the same client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PublishWeekRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Fetch plan
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Version check
        if (plan.Version != req.Version)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict. The plan was modified by another request." },
                409, cancellation: ct);
            return;
        }

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);
        if (week is null)
        {
            ThrowError($"Week {req.WeekNumber} not found in plan.");
            return;
        }

        if (week.Status == WeekStatus.Published)
        {
            ThrowError($"Week {req.WeekNumber} is already published.");
            return;
        }

        // Check if this is the first published week — if so, archive other active plans
        var hadPublishedWeeks = plan.Weeks.Any(w => w.Status == WeekStatus.Published);
        if (!hadPublishedWeeks)
        {
            var archiveFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, plan.ClientId)
                                & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active)
                                & Builders<NutritionPlan>.Filter.Ne(p => p.ExternalId, plan.ExternalId);

            var archiveUpdate = Builders<NutritionPlan>.Update
                .Set(p => p.Status, NutritionPlanStatus.Archived)
                .Set(p => p.DateUpdated, DateTime.UtcNow);

            await mongo.NutritionPlans.UpdateManyAsync(archiveFilter, archiveUpdate, cancellationToken: ct);
        }

        // Publish the week
        week.Status = WeekStatus.Published;
        week.DatePublished = DateTime.UtcNow;
        plan.Status = NutritionPlanStatus.Active;
        plan.DateUpdated = DateTime.UtcNow;
        plan.Version += 1;

        var versionFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.NutritionPlans.ReplaceOneAsync(versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict." }, 409, cancellation: ct);
            return;
        }

        await Send.OkAsync(GetPlanResponse.FromDocument(plan), ct);
    }
}
```

- [ ] **Step 3: Build and verify**

Run: `cd backend/FitnessPlatform.Application && dotnet build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/NutritionPlans/PublishWeek/
git commit -m "feat(backend): add per-week publish endpoint"
```

---

## Task 4: Backend — Write tests for new endpoints

**Files:**
- Create: `backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/UpdatePlanFullStateTests.cs`
- Create: `backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/PublishWeekEndpointTests.cs`

- [ ] **Step 1: Write UpdatePlan full-state tests**

Create `backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/UpdatePlanFullStateTests.cs`:
```csharp
using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for the full-state UpdatePlanEndpoint.
/// </summary>
public class UpdatePlanFullStateTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidFullState_UpdatesPlan()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();

        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, macroCalc);

        var foodId = Guid.NewGuid();
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks =
            [
                new UpdateWeekRequest
                {
                    WeekNumber = 1,
                    Days =
                    [
                        new UpdateDayRequest
                        {
                            DayOfWeek = 1,
                            Meals =
                            [
                                new UpdateMealRequest
                                {
                                    Name = "Breakfast",
                                    Order = 1,
                                    Foods =
                                    [
                                        new UpdateMealFoodRequest
                                        {
                                            FoodExternalId = foodId,
                                            FoodName = "Oatmeal",
                                            NutrientValuePer100Grams = new NutrientValue
                                            {
                                                Kcal = 370, Protein = 13, Carbs = 66, Fat = 7
                                            },
                                            AmountGrams = 100
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await mongo.NutritionPlans.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p => p.Name == "Updated Plan" && p.Version == 2),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());

        macroCalc.Received().RecalculateTotals(Arg.Any<NutritionPlan>());
    }

    [Fact]
    public async Task HandleAsync_VersionMismatch_Returns409()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId, version: 2);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();

        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, macroCalc);

        // Send version=1 but plan is at version=2 — early check catches mismatch
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Test",
            Version = 1,
            Weeks = [new UpdateWeekRequest { WeekNumber = 1, Days = [] }]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_RemovePublishedWeek_ThrowsError()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId, weekCount: 2);
        plan.Weeks[0].Status = WeekStatus.Published;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();

        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, macroCalc);

        // Only send week 2, removing published week 1
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Test",
            Version = 1,
            Weeks = [new UpdateWeekRequest { WeekNumber = 2, Days = [] }]
        };

        var act = () => ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var macroCalc = Substitute.For<IMacroCalculatorService>();

        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Test",
            Version = 1,
            Weeks = [new UpdateWeekRequest { WeekNumber = 1, Days = [] }]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_PreservesPublishedWeekStatus()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId, weekCount: 2);
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();

        var ep = Factory.Create<UpdatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated",
            Version = 1,
            Weeks =
            [
                new UpdateWeekRequest { WeekNumber = 1, Days = [] },
                new UpdateWeekRequest { WeekNumber = 2, Days = [] }
            ]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await mongo.NutritionPlans.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Weeks[0].Status == WeekStatus.Published &&
                p.Weeks[0].DatePublished != null &&
                p.Weeks[1].Status == WeekStatus.Draft &&
                p.Status == NutritionPlanStatus.Active),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
```

- [ ] **Step 2: Write PublishWeek tests**

Create `backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/PublishWeekEndpointTests.cs`:
```csharp
using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.PublishWeek;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="PublishWeekEndpoint"/>.
/// </summary>
public class PublishWeekEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_DraftWeek_PublishesSuccessfully()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId, weekCount: 2);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<PublishWeekEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(
            new PublishWeekRequest { PlanId = planId, WeekNumber = 1, Version = 1 },
            TestContext.Current.CancellationToken);

        // Should archive other active plans
        await mongo.NutritionPlans.Received().UpdateManyAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<UpdateDefinition<NutritionPlan>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // Should replace plan with published week
        await mongo.NutritionPlans.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Weeks[0].Status == WeekStatus.Published &&
                p.Status == NutritionPlanStatus.Active),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyPublished_ThrowsError()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, nutritionistId: _nutritionistId);
        plan.Weeks[0].Status = WeekStatus.Published;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<PublishWeekEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var act = () => ep.HandleAsync(
            new PublishWeekRequest { PlanId = planId, WeekNumber = 1, Version = 1 },
            TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<PublishWeekEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(
            new PublishWeekRequest { PlanId = Guid.NewGuid(), WeekNumber = 1, Version = 1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
```

- [ ] **Step 3: Run tests**

Run: `cd backend && dotnet test --filter "FullName~UpdatePlanFullState|FullName~PublishWeekEndpoint"`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/UpdatePlanFullStateTests.cs \
  backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/PublishWeekEndpointTests.cs
git commit -m "test(backend): add tests for full-state update and per-week publish"
```

---

## Task 5: Backend — Remove old endpoints and tests

**Files:**
- Delete: `Features/NutritionPlans/AddMeal/` (entire folder)
- Delete: `Features/NutritionPlans/DeleteMeal/` (entire folder)
- Delete: `Features/NutritionPlans/AddFoodToMeal/` (entire folder)
- Delete: `Features/NutritionPlans/RemoveFoodFromMeal/` (entire folder)
- Delete: `Features/NutritionPlans/UpdateDay/` (entire folder)
- Delete: `Features/NutritionPlans/UpdateMeal/` (entire folder)
- Delete: `Features/NutritionPlans/PublishPlan/` (entire folder)
- Delete: `Features/NutritionPlans/DuplicatePlan/` (entire folder)
- Delete: `Endpoints/NutritionPlans/AddMealEndpointTests.cs`
- Delete: `Endpoints/NutritionPlans/DeleteMealEndpointTests.cs`
- Delete: `Endpoints/NutritionPlans/AddFoodToMealEndpointTests.cs`
- Delete: `Endpoints/NutritionPlans/RemoveFoodFromMealEndpointTests.cs`
- Delete: `Endpoints/NutritionPlans/DuplicatePlanEndpointTests.cs`
- Delete: `Endpoints/NutritionPlans/PublishPlanEndpointTests.cs`

- [ ] **Step 1: Delete old endpoint folders**

```bash
rm -rf backend/FitnessPlatform.Application/Features/NutritionPlans/AddMeal
rm -rf backend/FitnessPlatform.Application/Features/NutritionPlans/DeleteMeal
rm -rf backend/FitnessPlatform.Application/Features/NutritionPlans/AddFoodToMeal
rm -rf backend/FitnessPlatform.Application/Features/NutritionPlans/RemoveFoodFromMeal
rm -rf backend/FitnessPlatform.Application/Features/NutritionPlans/UpdateDay
rm -rf backend/FitnessPlatform.Application/Features/NutritionPlans/UpdateMeal
rm -rf backend/FitnessPlatform.Application/Features/NutritionPlans/PublishPlan
rm -rf backend/FitnessPlatform.Application/Features/NutritionPlans/DuplicatePlan
```

- [ ] **Step 2: Delete old test files**

```bash
rm backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/AddMealEndpointTests.cs
rm backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/DeleteMealEndpointTests.cs
rm backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/AddFoodToMealEndpointTests.cs
rm backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/RemoveFoodFromMealEndpointTests.cs
rm backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/DuplicatePlanEndpointTests.cs
rm backend/FitnessPlatform.Tests/Endpoints/NutritionPlans/PublishPlanEndpointTests.cs
```

- [ ] **Step 3: Build and test**

Run: `cd backend/FitnessPlatform.Application && dotnet build`
Run: `cd backend && dotnet test`
Expected: Build succeeds, all remaining tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A backend/
git commit -m "refactor(backend): remove old granular plan endpoints replaced by full-state update"
```

---

## Task 6: Frontend — Update API types and plan API client

**Files:**
- Modify: `web/src/api/plan-types.ts`
- Modify: `web/src/api/plans.ts`

- [ ] **Step 1: Update plan-types.ts**

Add `WeekStatus` to `PlanWeek`, update `UpdatePlanRequest`, remove old request types:

In `plan-types.ts`, update the `PlanWeek` interface:
```typescript
/** A week within the nutrition plan. */
export interface PlanWeek {
  weekNumber: number;
  status: 'Draft' | 'Published';
  datePublished?: string | null;
  days: PlanDay[];
}
```

Update `UpdatePlanRequest`:
```typescript
/** Request to update a nutrition plan (full state). */
export interface UpdatePlanRequest {
  name: string;
  globalSettings?: GlobalNutritionSettings | null;
  weeks: UpdateWeekRequest[];
  version: number;
}

/** A week in the update request. */
export interface UpdateWeekRequest {
  weekNumber: number;
  days: UpdateDayRequest[];
}

/** A day in the update request. */
export interface UpdateDayRequest {
  dayOfWeek: number;
  meals: UpdateMealRequest[];
}

/** A meal in the update request. */
export interface UpdateMealRequest {
  mealId?: string | null;
  name: string;
  order: number;
  foods: UpdateMealFoodRequest[];
}

/** A food in the update request. */
export interface UpdateMealFoodRequest {
  foodExternalId: string;
  foodName: string;
  nutrientValuePer100Grams: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number | null;
    sugar?: number | null;
    saturatedFat?: number | null;
    salt?: number | null;
  };
  amountGrams: number;
}
```

Remove `NutritionPlanDetail.datePublished` property.

Remove `AddMealRequest` and `AddFoodToMealRequest` interfaces (no longer needed).

- [ ] **Step 2: Update plans.ts API client**

Replace the entire file — keep `getPlans`, `getPlan`, `createPlan`, `deletePlan`. Replace `updatePlan` to send full state. Add `publishWeek`. Remove all granular endpoints:

```typescript
import api from '@/lib/api';
import type {
  NutritionPlanDetail,
  GetPlansResponse,
  CreatePlanRequest,
  UpdatePlanRequest,
} from './plan-types';

/** Fetch paginated list of nutrition plans. */
export async function getPlans(params: {
  clientId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<GetPlansResponse> {
  const { data } = await api.get<GetPlansResponse>('/nutrition/plans', { params });
  return data;
}

/** Get a single nutrition plan by ID. */
export async function getPlan(planId: string): Promise<NutritionPlanDetail> {
  const { data } = await api.get<NutritionPlanDetail>(`/nutrition/plans/${planId}`);
  return data;
}

/** Create a new nutrition plan. */
export async function createPlan(request: CreatePlanRequest): Promise<NutritionPlanDetail> {
  const { data } = await api.post<NutritionPlanDetail>('/nutrition/plans', request);
  return data;
}

/** Full-state update of a nutrition plan. */
export async function updatePlan(
  planId: string,
  request: UpdatePlanRequest,
): Promise<NutritionPlanDetail> {
  const { data } = await api.put<NutritionPlanDetail>(`/nutrition/plans/${planId}`, request);
  return data;
}

/** Delete a nutrition plan. */
export async function deletePlan(planId: string): Promise<void> {
  await api.delete(`/nutrition/plans/${planId}`);
}

/** Publish a single week of a nutrition plan. */
export async function publishWeek(
  planId: string,
  weekNumber: number,
  version: number,
): Promise<NutritionPlanDetail> {
  const { data } = await api.post<NutritionPlanDetail>(
    `/nutrition/plans/${planId}/weeks/${weekNumber}/publish`,
    { version },
  );
  return data;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/api/plan-types.ts web/src/api/plans.ts
git commit -m "feat(web): update API types and client for full-state plan update"
```

---

## Task 7: Frontend — Rewrite Zustand store for local-only mutations

**Files:**
- Modify: `web/src/stores/nutritionPlan.ts`

- [ ] **Step 1: Rewrite the store**

Replace `web/src/stores/nutritionPlan.ts` entirely. Key changes:
- Remove all API imports except `getPlan`, `updatePlan`, `publishWeek`
- Remove `persistDays`, debounce timer, `refreshPlan`
- All mutation actions only update local state and set `isDirty = true`
- Add `save()` that builds `UpdatePlanRequest` from current plan state and calls the API
- Add `publishWeek()` that calls the publish endpoint
- Add `addWeek()` and `removeWeek()`

```typescript
import { create } from 'zustand';
import type {
  NutritionPlanDetail,
  PlanMeal,
  MealFood,
  NutrientTotals,
  UpdatePlanRequest,
} from '@/api/plan-types';
import { updatePlan as apiUpdatePlan, publishWeek as apiPublishWeek, getPlan } from '@/api/plans';

interface NutritionPlanState {
  plan: NutritionPlanDetail | null;
  isDirty: boolean;
  isSaving: boolean;
  selectedWeek: number;
  setPlan: (plan: NutritionPlanDetail) => void;
  setSelectedWeek: (week: number) => void;
  updateFoodAmount: (
    weekNum: number,
    dayOfWeek: number,
    mealId: string,
    foodExternalId: string,
    amountGrams: number,
  ) => void;
  addFoodToMeal: (weekNum: number, dayOfWeek: number, mealId: string, food: MealFood) => void;
  removeFoodFromMeal: (
    weekNum: number,
    dayOfWeek: number,
    mealId: string,
    foodExternalId: string,
  ) => void;
  addMeal: (weekNum: number, dayOfWeek: number, meal: PlanMeal) => void;
  removeMeal: (weekNum: number, dayOfWeek: number, mealId: string) => void;
  updateMealName: (weekNum: number, dayOfWeek: number, mealId: string, name: string) => void;
  reorderMeals: (weekNum: number, dayOfWeek: number, mealIds: string[]) => void;
  moveMealToDay: (
    weekNum: number,
    fromDayOfWeek: number,
    toDayOfWeek: number,
    mealId: string,
    targetIndex: number,
  ) => void;
  swapDays: (weekNum: number, fromDayOfWeek: number, toDayOfWeek: number) => void;
  addWeek: () => void;
  removeWeek: (weekNum: number) => void;
  save: () => Promise<void>;
  publishWeek: (weekNumber: number) => Promise<void>;
}

/** Calculate nutrient totals for a list of foods using Atwater factors. */
function calculateMealTotals(foods: MealFood[]): NutrientTotals {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const food of foods) {
    const scale = food.amountGrams / 100;
    const p = food.nutrientValuePer100Grams.protein * scale;
    const c = food.nutrientValuePer100Grams.carbs * scale;
    const f = food.nutrientValuePer100Grams.fat * scale;
    protein += p;
    carbs += c;
    fat += f;
    kcal += p * 4 + c * 4 + f * 9;
  }

  return {
    kcal: Math.round(kcal * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

/** Recalculate all meal and day totals in the plan. */
function recalculateTotals(plan: NutritionPlanDetail): NutritionPlanDetail {
  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => {
        const meals = day.meals.map((meal) => ({
          ...meal,
          mealTotals: calculateMealTotals(meal.foods),
        }));

        const dayTotals: NutrientTotals = {
          kcal: meals.reduce((sum, m) => sum + (m.mealTotals?.kcal ?? 0), 0),
          protein: meals.reduce((sum, m) => sum + (m.mealTotals?.protein ?? 0), 0),
          carbs: meals.reduce((sum, m) => sum + (m.mealTotals?.carbs ?? 0), 0),
          fat: meals.reduce((sum, m) => sum + (m.mealTotals?.fat ?? 0), 0),
        };

        return { ...day, meals, dayTotals };
      }),
    })),
  };
}

/** Helper: immutably update a specific day's meals within the plan. */
function updateDay(
  plan: NutritionPlanDetail,
  weekNum: number,
  dayOfWeek: number,
  updater: (meals: PlanMeal[]) => PlanMeal[],
): NutritionPlanDetail {
  return {
    ...plan,
    weeks: plan.weeks.map((week) =>
      week.weekNumber !== weekNum
        ? week
        : {
            ...week,
            days: week.days.map((day) =>
              day.dayOfWeek !== dayOfWeek
                ? day
                : { ...day, meals: updater(day.meals) },
            ),
          },
    ),
  };
}

export const useNutritionPlanStore = create<NutritionPlanState>((set, get) => ({
  plan: null,
  isDirty: false,
  isSaving: false,
  selectedWeek: 1,

  setPlan: (plan) => {
    set({ plan: recalculateTotals(plan), isDirty: false, selectedWeek: 1 });
  },

  setSelectedWeek: (week) => {
    set({ selectedWeek: week });
  },

  updateFoodAmount: (weekNum, dayOfWeek, mealId, foodExternalId, amountGrams) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.map((meal) =>
        meal.mealId !== mealId
          ? meal
          : {
              ...meal,
              foods: meal.foods.map((food) =>
                food.foodExternalId !== foodExternalId
                  ? food
                  : { ...food, amountGrams },
              ),
            },
      ),
    );

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  addFoodToMeal: (weekNum, dayOfWeek, mealId, food) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.map((meal) =>
        meal.mealId !== mealId
          ? meal
          : { ...meal, foods: [...meal.foods, food] },
      ),
    );

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  removeFoodFromMeal: (weekNum, dayOfWeek, mealId, foodExternalId) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.map((meal) =>
        meal.mealId !== mealId
          ? meal
          : {
              ...meal,
              foods: meal.foods.filter((f) => f.foodExternalId !== foodExternalId),
            },
      ),
    );

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  addMeal: (weekNum, dayOfWeek, meal) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) => [...meals, meal]);
    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  removeMeal: (weekNum, dayOfWeek, mealId) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.filter((m) => m.mealId !== mealId),
    );
    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  updateMealName: (weekNum, dayOfWeek, mealId, name) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.map((meal) =>
        meal.mealId !== mealId ? meal : { ...meal, name },
      ),
    );
    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  reorderMeals: (weekNum, dayOfWeek, mealIds) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      mealIds
        .map((id, idx) => {
          const meal = meals.find((m) => m.mealId === id);
          return meal ? { ...meal, order: idx + 1 } : null;
        })
        .filter(Boolean) as PlanMeal[],
    );
    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  moveMealToDay: (weekNum, fromDayOfWeek, toDayOfWeek, mealId, targetIndex) => {
    const { plan } = get();
    if (!plan || fromDayOfWeek === toDayOfWeek) return;

    const week = plan.weeks.find((w) => w.weekNumber === weekNum);
    if (!week) return;

    const srcDay = week.days.find((d) => d.dayOfWeek === fromDayOfWeek);
    const meal = srcDay?.meals.find((m) => m.mealId === mealId);
    if (!meal) return;

    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((w) => {
        if (w.weekNumber !== weekNum) return w;
        return {
          ...w,
          days: w.days.map((day) => {
            if (day.dayOfWeek === fromDayOfWeek) {
              const remaining = day.meals
                .filter((m) => m.mealId !== mealId)
                .sort((a, b) => a.order - b.order)
                .map((m, i) => ({ ...m, order: i + 1 }));
              return { ...day, meals: remaining };
            }
            if (day.dayOfWeek === toDayOfWeek) {
              const sorted = day.meals.slice().sort((a, b) => a.order - b.order);
              const idx = Math.min(targetIndex, sorted.length);
              sorted.splice(idx, 0, meal);
              const renumbered = sorted.map((m, i) => ({ ...m, order: i + 1 }));
              return { ...day, meals: renumbered };
            }
            return day;
          }),
        };
      }),
    };

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  swapDays: (weekNum, fromDayOfWeek, toDayOfWeek) => {
    const { plan } = get();
    if (!plan || fromDayOfWeek === toDayOfWeek) return;

    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) => {
        if (week.weekNumber !== weekNum) return week;

        const dayOrder = [1, 2, 3, 4, 5, 6, 7];
        const fromIdx = dayOrder.indexOf(fromDayOfWeek);
        const toIdx = dayOrder.indexOf(toDayOfWeek);
        dayOrder.splice(fromIdx, 1);
        dayOrder.splice(toIdx, 0, fromDayOfWeek);

        const daysByOriginal = new Map(week.days.map((d) => [d.dayOfWeek, d]));
        const newDays = dayOrder.map((origDay, idx) => {
          const day = daysByOriginal.get(origDay) ?? {
            dayOfWeek: idx + 1,
            meals: [],
            dayTotals: null,
          };
          return { ...day, dayOfWeek: idx + 1 };
        });

        return { ...week, days: newDays };
      }),
    };

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  addWeek: () => {
    const { plan } = get();
    if (!plan) return;

    const maxWeekNum = Math.max(0, ...plan.weeks.map((w) => w.weekNumber));
    const newWeek = {
      weekNumber: maxWeekNum + 1,
      status: 'Draft' as const,
      datePublished: null,
      days: Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i + 1,
        meals: [],
        dayTotals: null,
      })),
    };

    set({
      plan: { ...plan, weeks: [...plan.weeks, newWeek] },
      isDirty: true,
    });
  },

  removeWeek: (weekNum) => {
    const { plan } = get();
    if (!plan || plan.weeks.length <= 1) return;

    const week = plan.weeks.find((w) => w.weekNumber === weekNum);
    if (!week || week.status === 'Published') return;

    const updated = {
      ...plan,
      weeks: plan.weeks.filter((w) => w.weekNumber !== weekNum),
    };

    set({ plan: updated, isDirty: true, selectedWeek: 1 });
  },

  save: async () => {
    const { plan } = get();
    if (!plan) return;

    set({ isSaving: true });
    try {
      const request: UpdatePlanRequest = {
        name: plan.name,
        globalSettings: plan.globalSettings,
        version: plan.version,
        weeks: plan.weeks.map((week) => ({
          weekNumber: week.weekNumber,
          days: week.days.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            meals: day.meals.map((meal) => ({
              mealId: meal.mealId,
              name: meal.name,
              order: meal.order,
              foods: meal.foods.map((food) => ({
                foodExternalId: food.foodExternalId,
                foodName: food.foodName,
                nutrientValuePer100Grams: food.nutrientValuePer100Grams,
                amountGrams: food.amountGrams,
              })),
            })),
          })),
        })),
      };

      const result = await apiUpdatePlan(plan.planId, request);
      set({ plan: recalculateTotals(result), isDirty: false, isSaving: false });
    } catch (error: unknown) {
      set({ isSaving: false });
      // On 409, silently refetch the plan (conflict resolved by reload)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 409) {
          const fresh = await getPlan(plan.planId);
          set({ plan: recalculateTotals(fresh), isDirty: false });
          return; // Don't re-throw — 409 is handled gracefully
        }
      }
      throw error;
    }
  },

  publishWeek: async (weekNumber) => {
    const { plan } = get();
    if (!plan) return;

    const result = await apiPublishWeek(plan.planId, weekNumber, plan.version);
    set({ plan: recalculateTotals(result), isDirty: false });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add web/src/stores/nutritionPlan.ts
git commit -m "refactor(web): rewrite plan store for local-only mutations with explicit save"
```

---

## Task 8: Frontend — Update PlanToolbar, add WeekSelector, update PlansPage

**Files:**
- Modify: `web/src/components/nutrition/PlanToolbar.tsx`
- Create: `web/src/components/nutrition/WeekSelector.tsx`
- Modify: `web/src/pages/PlansPage.tsx`

- [ ] **Step 1: Update PlanToolbar — remove week selector, add tabs and Save button**

The toolbar now shows: plan name on the left, save indicator + Save button on the right. Tabs below. Week selector is moved out. Replace the entire file content. The tabs are controlled by `activeTab` / `onTabChange` props. The Save button calls `onSave`.

Key props: `planName`, `isDirty`, `isSaving`, `activeTab`, `onTabChange`, `onSave`.

- [ ] **Step 2: Create WeekSelector component**

Create `web/src/components/nutrition/WeekSelector.tsx`. Shows week buttons with status badges (Draft yellow, Published green), "Publish Week X" button for Draft weeks, "+ Add Week" and "Remove Week" buttons. Props: `weeks` (array with weekNumber + status), `selectedWeek`, `onWeekChange`, `onPublishWeek`, `onAddWeek`, `onRemoveWeek`.

- [ ] **Step 3: Update PlansPage — remove duplicate button**

In `web/src/pages/PlansPage.tsx`, remove the duplicate button and its handler (`handleDuplicate`). Remove the `duplicatePlan` import from `@/api/plans`.

- [ ] **Step 4: Build and verify**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/nutrition/PlanToolbar.tsx \
  web/src/components/nutrition/WeekSelector.tsx \
  web/src/pages/PlansPage.tsx
git commit -m "feat(web): update toolbar with tabs, add WeekSelector, remove duplicate from PlansPage"
```

---

## Task 9: Frontend — Create NutritionGoalsTab component

**Files:**
- Create: `web/src/components/nutrition/NutritionGoalsTab.tsx`

- [ ] **Step 1: Create read-only nutrition goals tab**

Create `web/src/components/nutrition/NutritionGoalsTab.tsx`. This component:
- Accepts `clientId: string` prop
- Fetches `getClientDashboard(clientId)` on mount
- Displays read-only: BMR→TDEE→Adjusted flow, activity level, goal, macro boxes (P/C/F), MacroSliders (read-only), MealDistribution (read-only)
- Shows loading state while fetching
- Shows fallback message when no onboarding data: "Nutrition goals not configured. Set them on the client detail page."

Reuse existing components `MacroSliders` and `MealDistribution` with their `onChange` prop set to undefined/omitted to make them effectively read-only (sliders still render but won't save). Alternatively, render them with a `pointer-events-none` wrapper for true read-only behavior.

- [ ] **Step 2: Commit**

```bash
git add web/src/components/nutrition/NutritionGoalsTab.tsx
git commit -m "feat(web): add read-only NutritionGoalsTab component"
```

---

## Task 10: Frontend — Rewrite NutritionPlanPage with tabs and explicit save

**Files:**
- Modify: `web/src/pages/NutritionPlanPage.tsx`

- [ ] **Step 1: Rewrite NutritionPlanPage**

Key changes:
- Remove auto-save `useEffect` and debounce timer
- Add `activeTab` state: `'mealPlan' | 'nutritionGoals'`
- Render `PlanToolbar` with tabs and Save button
- When `activeTab === 'mealPlan'`: show `WeekSelector` + `DragDropProvider` with day columns (existing logic)
- When `activeTab === 'nutritionGoals'`: show `NutritionGoalsTab` with the plan's `clientId`
- Save button calls `store.save()`, shows toast on success/error
- Publish week calls `store.publishWeek()` with confirmation dialog
- Add/remove week calls `store.addWeek()` / `store.removeWeek()`
- Add `beforeunload` event handler when `isDirty` is true to warn about unsaved changes:
  ```typescript
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
  ```

- [ ] **Step 2: Build and verify**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/NutritionPlanPage.tsx
git commit -m "feat(web): rewrite plan page with tabs, explicit save, per-week publish"
```

---

## Task 11: Frontend — Update DayColumn and MealCard with distribution targets

**Files:**
- Modify: `web/src/components/nutrition/DayColumn.tsx`
- Modify: `web/src/components/nutrition/MealCard.tsx`

- [ ] **Step 1: Update DayColumn**

Add new props:
- `mealDistribution?: Record<string, number> | null` — percentages per meal name
- `dailyKcal?: number | null` — total daily target

Changes:
- Show day nutrition totals (kcal, P, C, F) directly under the day label, styled as compact colored text
- If `mealDistribution` is provided, derive `mealTargets` array from distribution names + percentages (skip 0% entries). For days with meals, match existing meals to targets by name. For days with zero meals, render empty placeholder sections for each target meal — these are **view-only placeholders** (not added to store state). When the user clicks "+ Food" or "+ Recipe" on a placeholder, create the actual meal in the store at that point.
- Pass `targetKcal` to each MealCard: `(distribution% / 100) * dailyKcal`

- [ ] **Step 2: Update MealCard**

Add new prop:
- `targetKcal?: number | null` — calorie target from meal distribution

Changes:
- Show "target {N}" text next to meal name (small, muted)
- When meal's `mealTotals.kcal > targetKcal`: red left border (`border-l-red-500`), show "⚠️ +{excess}" indicator in red, show kcal line in red
- Default state: normal gray left border

- [ ] **Step 3: Build and verify**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/nutrition/DayColumn.tsx \
  web/src/components/nutrition/MealCard.tsx
git commit -m "feat(web): add meal distribution targets and calorie warnings to day columns"
```

---

## Task 12: Frontend — Add i18n keys

**Files:**
- Modify: `web/src/i18n/locales/en.json`
- Modify: `web/src/i18n/locales/cs.json`
- Modify: `web/src/i18n/locales/de.json`

- [ ] **Step 1: Add English keys**

Add under `nutrition`:
```json
"tabMealPlan": "Meal Plan",
"tabNutritionGoals": "Nutrition Goals",
"weekDraft": "Draft",
"weekPublished": "Published",
"publishWeek": "Publish Week {{number}}",
"confirmPublishWeek": "Publishing this week will make it visible to the client. Continue?",
"weekPublished_success": "Week {{number}} published",
"addWeek": "+ Add Week",
"removeWeek": "Remove Week",
"target": "target {{kcal}}",
"overBy": "+{{amount}}",
"savePlan": "Save",
"planSaved": "Plan saved",
"noNutritionGoals": "Nutrition goals not configured. Set them on the client detail page.",
"versionConflict": "Plan was modified elsewhere. Reloading..."
```

- [ ] **Step 2: Add Czech translations**

- [ ] **Step 3: Add German translations**

- [ ] **Step 4: Commit**

```bash
git add web/src/i18n/locales/
git commit -m "feat(web): add i18n keys for plan page rework"
```

---

## Task 13: Integration verification

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && dotnet test`
Expected: All tests pass.

- [ ] **Step 2: Run frontend type check**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Run frontend dev server and smoke test**

Run: `cd web && npm run dev`
Verify:
- Plans list page loads, no duplicate button
- Click into a plan → two tabs visible (Meal Plan, Nutrition Goals)
- Meal Plan tab: week selector with Draft/Published badges, day columns with meals
- Add food to meal → unsaved changes indicator appears
- Click Save → changes persist, indicator clears
- Nutrition Goals tab: read-only display of client's goals
- Publish Week → week badge changes to Published

- [ ] **Step 4: Final commit if any fixes needed**
