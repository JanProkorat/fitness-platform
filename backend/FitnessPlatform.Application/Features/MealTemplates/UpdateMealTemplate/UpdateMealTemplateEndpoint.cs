using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.MealTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;

namespace FitnessPlatform.Application.Features.MealTemplates.UpdateMealTemplate;

/// <summary>
/// Updates an existing meal template owned by the caller, with optimistic-concurrency CAS on
/// <c>Version</c> and server-recomputed nutrient totals.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Shared meal-totals calculator (#859).</param>
/// <param name="guard">Shared version-gated fetch-check-replace skeleton.</param>
/// <param name="timeProvider">Injected system clock.</param>
internal sealed class UpdateMealTemplateEndpoint(
    IMongoContext mongo,
    IMacroCalculatorService macroCalculator,
    PlanConcurrencyGuard guard,
    TimeProvider timeProvider)
    : Endpoint<UpdateMealTemplateRequest, MealTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/nutrition/meal-templates/{TemplateId}");
        Roles(AppRoles.Nutritionist);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(UpdateMealTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Update meal template";
            s.Description = "Updates a meal template owned by the calling nutritionist. Visibility grants read access only — writing always requires ownership.";
            s.Responses[StatusCodes.Status200OK] = "Meal template updated";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "Readable but owned by another nutritionist";
            s.Responses[StatusCodes.Status404NotFound] = "Meal template not found, or another owner's private template";
            s.Responses[StatusCodes.Status409Conflict] = "Stale Version — the template was modified by another request";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateMealTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var updated = await this.LoadAndReplaceLibraryEntryWithVersionGuardAsync(
            mongo.MealTemplates,
            req.TemplateId,
            nutritionistId,
            MealTemplateErrors.Denial,
            req.Version,
            guard,
            mutate: (template, _) =>
            {
                template.Name = req.Name;
                template.Description = req.Description;
                template.Kind = req.Kind;
                template.Foods = req.Foods;
                template.Recipes = req.Recipes;
                template.TotalNutrients = macroCalculator.CalculateMealTotals(req.Foods, req.Recipes);
                template.Visibility = req.Visibility;
                template.DateUpdated = timeProvider.GetUtcNow().UtcDateTime;
                template.Version += 1;
                return Task.FromResult(true);
            },
            ct);

        if (updated is null)
        {
            return;
        }

        await Send.OkAsync(MealTemplateDetailResponse.FromDocument(updated, nutritionistId), ct);
    }
}
