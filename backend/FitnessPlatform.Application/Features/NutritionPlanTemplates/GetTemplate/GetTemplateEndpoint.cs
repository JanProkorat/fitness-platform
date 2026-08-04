using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.GetTemplate;

/// <summary>
/// Fetches a single nutrition plan template's full detail — the caller's own entry at any
/// visibility, or any nutritionist's <c>Public</c> entry.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetTemplateEndpoint(IMongoContext mongo)
    : Endpoint<GetTemplateRequest, NutritionPlanTemplateDetailDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/plan-templates/{TemplateId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get nutrition plan template detail";
            s.Description = "Returns the full week tree for a template the caller owns, or any Public template.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerId = Guid.Parse(userId);

        var template = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.NutritionPlanTemplates, req.TemplateId, callerId, NutritionPlanTemplateLibrary.Denial, ct);

        if (template is null)
        {
            return;
        }

        await Send.OkAsync(NutritionPlanTemplateDetailDto.FromDocument(template), ct);
    }
}
