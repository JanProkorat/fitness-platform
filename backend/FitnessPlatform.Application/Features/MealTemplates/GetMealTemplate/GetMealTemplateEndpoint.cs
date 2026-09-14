using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.MealTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;

namespace FitnessPlatform.Application.Features.MealTemplates.GetMealTemplate;

/// <summary>
/// Retrieves a single meal template by its public identifier. Nutritionists see their own
/// templates at any visibility and other nutritionists' public templates.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
internal sealed class GetMealTemplateEndpoint(IMongoContext mongo)
    : Endpoint<GetMealTemplateRequest, MealTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/meal-templates/{TemplateId}");
        Roles(AppRoles.Nutritionist);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(GetMealTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Get meal template";
            s.Description = "Returns full detail of a meal template. Nutritionists can read their own templates (any visibility) and public templates owned by others; other nutritionists' private templates return 404, identical to a genuinely missing template.";
            s.Responses[StatusCodes.Status200OK] = "Meal template detail";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Meal template not found, or not readable by the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetMealTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var template = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.MealTemplates, req.TemplateId, nutritionistId, MealTemplateErrors.Denial, ct);

        if (template is null)
        {
            return;
        }

        await Send.OkAsync(MealTemplateDetailResponse.FromDocument(template, nutritionistId), ct);
    }
}
