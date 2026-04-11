using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Full-state update of a nutrition plan: replaces name, settings, and all weeks/days/meals/foods.
/// Preserves per-week Status and DatePublished. Uses optimistic concurrency.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Service to recalculate nutrient totals.</param>
public class UpdatePlanEndpoint(IMongoContext mongo, IMacroCalculatorService macroCalculator, IApplicationDbContext db, IRealtimeNotifier notifier)
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

        // Map request to domain
        plan.Name = req.Name;
        plan.StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null;
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
                    Note = rd.Note,
                    Meals = rd.Meals.Select(rm => new PlanMeal
                    {
                        MealId = rm.MealId ?? Guid.NewGuid(),
                        Kind = rm.Kind,
                        Order = rm.Order,
                        Time = rm.Time,
                        Note = rm.Note,
                        Foods = rm.Foods.Select(rf => new MealFood
                        {
                            FoodExternalId = rf.FoodExternalId,
                            FoodName = rf.FoodName,
                            FoodNameCs = rf.FoodNameCs,
                            FoodNameEn = rf.FoodNameEn,
                            FoodNameDe = rf.FoodNameDe,
                            FoodCategory = rf.FoodCategory,
                            NutrientValuePer100Grams = rf.NutrientValuePer100Grams,
                            AmountGrams = rf.AmountGrams,
                            Note = rf.Note
                        }).ToList(),
                        Recipes = rm.Recipes.Select(rr => new MealRecipe
                        {
                            RecipeId = rr.RecipeId,
                            RecipeName = rr.RecipeName,
                            NutrientValuePerServing = rr.NutrientValuePerServing,
                            Servings = rr.Servings,
                            Note = rr.Note,
                            FoodCategories = rr.FoodCategories
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

        // Notify the client in real-time when published weeks were modified
        if (plan.Weeks.Any(w => w.Status == WeekStatus.Published))
        {
            var clientProfile = await db.ClientProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(cp => cp.PublicId == plan.ClientId, ct);

            if (clientProfile is not null)
            {
                await notifier.NotifyAsync(clientProfile.UserId, "nutritionPlanUpdated", new
                {
                    PlanId = plan.ExternalId,
                }, ct);
            }
        }

        await Send.OkAsync(GetPlanResponse.FromDocument(plan), ct);
    }
}
