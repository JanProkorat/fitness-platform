using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Domain.Extensions;
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
/// <param name="db">Relational database context used to resolve the client user id for notifications.</param>
/// <param name="notifier">Realtime notifier used to push the plan-updated event to the client.</param>
/// <param name="guard">Shared version-gated fetch-check-replace-409 skeleton.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities — authorship identifies the
/// plan, the caller's live link to its client decides access.</param>
public class UpdatePlanEndpoint(
    IMongoContext mongo,
    IMacroCalculatorService macroCalculator,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    PlanConcurrencyGuard guard,
    IClientLinkAuthorizationService linkAuthorizationService)
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

        var lookupFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);
        var replaceFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var guardResult = await guard.ReplaceWithVersionGuardAsync(
            mongo.NutritionPlans,
            lookupFilter,
            replaceFilter,
            req.Version,
            p => p.Version,
            (plan, authorizeCt) => AuthorizeAsync(plan, nutritionistId, authorizeCt),
            (plan, _) => MutateAsync(plan, req),
            ct);

        switch (guardResult.Outcome)
        {
            case PlanConcurrencyOutcome.NotFound:
                await Send.NotFoundAsync(ct);
                return;
            case PlanConcurrencyOutcome.VersionConflict:
                await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                    "Version conflict. The plan was modified by another request.", ct);
                return;
            case PlanConcurrencyOutcome.ReplaceConflict:
                await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                    "Version conflict. The plan was modified concurrently.", ct);
                return;
            case PlanConcurrencyOutcome.HandledByMutator:
                // The authorize delegate already wrote its 404.
                return;
        }

        var plan = guardResult.Document!;

        // Notify the client in real-time when published weeks were modified
        if (plan.Weeks.Any(w => w.Status == WeekStatus.Published))
        {
            // NutritionPlan.ClientId is ApplicationUser.Id (#840).
            var clientProfile = await db.ClientProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(cp => cp.UserId == plan.ClientId, ct);

            if (clientProfile is not null)
            {
                await notifier.NotifyAsync(clientProfile.UserId, "nutritionplanupdated", new
                {
                    PlanId = plan.ExternalId,
                }, ct);
            }
        }

        // Response ClientId must stay the client-facing ClientProfile.PublicId (pre-#840
        // contract), regardless of whether the published-week notification branch above ran.
        var clientPublicId = await db.ResolveClientPublicIdAsync(plan.ClientId, ct);
        await Send.OkAsync(GetPlanResponse.FromDocument(plan, clientPublicId), ct);
    }

    /// <summary>
    /// The lookup filter proved authorship, which is permanent. Access is not — require the
    /// caller's link to the plan's client to still grant nutrition access. Runs before the
    /// guard's version comparison so a denial is indistinguishable from a missing plan.
    /// </summary>
    private async Task<bool> AuthorizeAsync(NutritionPlan plan, Guid nutritionistId, CancellationToken ct)
    {
        // plan.ClientId is ApplicationUser.Id (#840) — the UserId-addressed overload.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
            nutritionistId, plan.ClientId, ct);

        if (capabilities is { CanViewNutritionPlans: true })
        {
            return true;
        }

        await Send.NotFoundAsync(ct);
        return false;
    }

    /// <summary>
    /// Endpoint-specific validation and mutation applied to the fetched plan before the
    /// version-gated replace. Synchronous — declared as returning <c>Task&lt;bool&gt;</c> to
    /// satisfy the guard's mutate-delegate contract. Always returns <c>true</c>: no error path
    /// here writes a response directly, validation failures throw via <c>ThrowError</c> instead.
    /// </summary>
    private Task<bool> MutateAsync(NutritionPlan plan, UpdatePlanRequest req)
    {
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
            return Task.FromResult(false);
        }

        // Start date validation
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (plan.StartDate.HasValue && req.StartDate?.Date != plan.StartDate.Value.Date)
        {
            // Trying to change or clear an existing start date
            if (DateOnly.FromDateTime(plan.StartDate.Value) < today)
            {
                ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be changed after it has arrived.");
                return Task.FromResult(false);
            }

            // Clearing: only allowed if no weeks are published
            if (!req.StartDate.HasValue && plan.Weeks.Any(w => w.Status == WeekStatus.Published))
            {
                ThrowError(ErrorCodes.StartDateLocked, "Start date cannot be cleared when weeks are published.");
                return Task.FromResult(false);
            }
        }

        if (req.StartDate.HasValue)
        {
            if (req.StartDate.Value.DayOfWeek != System.DayOfWeek.Monday)
            {
                ThrowError(ErrorCodes.StartDateNotMonday, "Start date must be a Monday.");
                return Task.FromResult(false);
            }

            // Only enforce "not in past" when the start date is being set or changed.
            // A plan that has already started naturally has a past start date in every
            // subsequent save — that must not block editing of other fields.
            var isStartDateNewOrChanged = !plan.StartDate.HasValue
                || req.StartDate.Value.Date != plan.StartDate.Value.Date;
            if (isStartDateNewOrChanged && DateOnly.FromDateTime(req.StartDate.Value) < today)
            {
                ThrowError(ErrorCodes.StartDateInPast, "Start date cannot be in the past.");
                return Task.FromResult(false);
            }
        }

        // Map request to domain
        plan.Name = req.Name;
        plan.StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null;
        plan.GlobalSettings = req.GlobalSettings;
        // Transitional guard: web/mobile clients built against the pre-#493 Swagger do not
        // yet send Goal/TargetWeightKg in their update payloads, so the fields arrive as
        // null. Blindly assigning would clobber a goal set at create-time or via the
        // backfill migration. Preserve the stored value whenever the caller omits the field.
        // Explicit clear-to-null will be supported once regen-api ships the updated contract.
        if (req.Goal.HasValue) plan.Goal = req.Goal;
        if (req.TargetWeightKg.HasValue) plan.TargetWeightKg = req.TargetWeightKg;
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

        // Map supplements (full-state replace)
        plan.Supplements = req.Supplements.Select(rs => new Supplement
        {
            ExternalId = rs.ExternalId ?? Guid.NewGuid(),
            Name = rs.Name,
            Dose = rs.Dose,
            Notes = rs.Notes
        }).ToList();

        // Recalculate totals
        macroCalculator.RecalculateTotals(plan);

        // Derive plan-level status from week statuses
        plan.Status = plan.Weeks.Any(w => w.Status == WeekStatus.Published)
            ? NutritionPlanStatus.Active
            : NutritionPlanStatus.Draft;

        plan.DateUpdated = DateTime.UtcNow;
        plan.Version += 1;

        return Task.FromResult(true);
    }
}
