using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.MealTemplates.GetMealTemplate;
using FitnessPlatform.Application.Features.MealTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.MealTemplates.SaveMealTemplateFromPlan;

/// <summary>
/// Saves a new meal template from an existing nutrition plan's meal. The caller must own the
/// source plan; the copied meal's foods/recipes and inherited <c>Kind</c> hint are taken
/// verbatim from the plan, and totals are recomputed through the same shared surface used for
/// every other meal-template write.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Shared meal-totals calculator (#859).</param>
/// <param name="timeProvider">Injected system clock.</param>
/// <param name="authHelper">Link capability helper — authorship identifies the source plan, the
/// caller's live link to its client decides access.</param>
internal sealed class SaveMealTemplateFromPlanEndpoint(
    IMongoContext mongo,
    IMacroCalculatorService macroCalculator,
    TimeProvider timeProvider,
    ProfessionalAuthHelper authHelper)
    : Endpoint<SaveMealTemplateFromPlanRequest, MealTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/meal-templates/from-plan");
        Roles(AppRoles.Nutritionist);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(SaveMealTemplateFromPlanEndpoint)));
        Summary(s =>
        {
            s.Summary = "Save meal template from plan";
            s.Description = "Copies the addressed PlanMeal's foods, recipes, and Kind hint into a new meal template owned by the caller. The plan, week/day, and meal must all resolve and the plan must belong to the caller — every failure of that chain returns the same shaped 404.";
            s.Responses[StatusCodes.Status201Created] = "Meal template created from the plan meal";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Plan not found/not owned by the caller, or the week/day/meal is not present";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SaveMealTemplateFromPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var sourceMeal = await LoadSourcePlanMealOrRespondAsync(req, nutritionistId, ct);

        if (sourceMeal is null)
        {
            return;
        }

        var template = new MealTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = nutritionistId,
            Name = req.Name,
            Description = req.Description,
            Kind = sourceMeal.Kind,
            Foods = sourceMeal.Foods,
            Recipes = sourceMeal.Recipes,
            TotalNutrients = macroCalculator.CalculateMealTotals(sourceMeal.Foods, sourceMeal.Recipes),
            Visibility = req.Visibility,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime,
            Version = 1
        };

        await mongo.MealTemplates.InsertOneAsync(template, cancellationToken: ct);

        await Send.CreatedAtAsync<GetMealTemplateEndpoint>(
            new { TemplateId = template.ExternalId },
            MealTemplateDetailResponse.FromDocument(template, nutritionistId),
            cancellation: ct);
    }

    /// <summary>
    /// Resolves the source <see cref="PlanMeal"/> addressed by <paramref name="req"/>, checking
    /// plan ownership and week/day/meal presence. Every failure — missing plan, unowned plan, or
    /// an absent week/day/meal — writes the identical shaped 404 via
    /// <see cref="MealTemplateErrors.Denial"/>, since <see cref="NutritionPlan"/> is not an
    /// <c>ILibraryDocument</c> and a bare <c>Send.NotFoundAsync</c> would produce a
    /// differently-shaped, code-less 404 than every other denial in this feature.
    /// </summary>
    private async Task<PlanMeal?> LoadSourcePlanMealOrRespondAsync(
        SaveMealTemplateFromPlanRequest req, Guid nutritionistId, CancellationToken ct)
    {
        using var cursor = await mongo.NutritionPlans.FindAsync(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId), cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.NutritionistId != nutritionistId)
        {
            await this.SendLibraryNotFoundAsync(MealTemplateErrors.Denial, ct);
            return null;
        }

        // Authorship is permanent; the collaboration is not. Require the caller's link to the
        // plan's client to still grant nutrition access, and route the denial through the same
        // shaped 404 as every other failure of this chain.
        var hasAccess = await authHelper.HasPlanAccessForClientUserAsync(
            nutritionistId, plan.ClientId, requireTrainingPlanAccess: false, ct);

        if (!hasAccess)
        {
            await this.SendLibraryNotFoundAsync(MealTemplateErrors.Denial, ct);
            return null;
        }

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);
        var day = week?.Days.FirstOrDefault(d => d.DayOfWeek == req.DayOfWeek);
        var meal = day?.Meals.FirstOrDefault(m => m.MealId == req.MealId);

        if (meal is null)
        {
            await this.SendLibraryNotFoundAsync(MealTemplateErrors.Denial, ct);
            return null;
        }

        return meal;
    }
}
