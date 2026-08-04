using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.MealTemplates.GetMealTemplate;
using FitnessPlatform.Application.Features.MealTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.MealTemplates.CreateMealTemplate;

/// <summary>
/// Creates a new reusable meal template with server-computed nutrient totals.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Shared meal-totals calculator (#859 — promoted from the
/// nutrition-plan write path so both report identical totals for the same underlying meal).</param>
/// <param name="timeProvider">Injected system clock.</param>
internal sealed class CreateMealTemplateEndpoint(
    IMongoContext mongo,
    IMacroCalculatorService macroCalculator,
    TimeProvider timeProvider)
    : Endpoint<CreateMealTemplateRequest, MealTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/meal-templates");
        Roles(AppRoles.Nutritionist);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(CreateMealTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Create meal template";
            s.Description = "Creates a new reusable meal template (foods + recipes) owned by the calling nutritionist. TotalNutrients is always recomputed server-side.";
            s.Responses[StatusCodes.Status201Created] = "Meal template created";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateMealTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var template = new MealTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = nutritionistId,
            Name = req.Name,
            Description = req.Description,
            Kind = req.Kind,
            Foods = req.Foods,
            Recipes = req.Recipes,
            TotalNutrients = macroCalculator.CalculateMealTotals(req.Foods, req.Recipes),
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
}
