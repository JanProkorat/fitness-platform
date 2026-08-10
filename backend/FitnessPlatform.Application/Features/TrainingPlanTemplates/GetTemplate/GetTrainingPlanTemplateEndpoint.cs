using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.GetTemplate;

/// <summary>
/// Fetches a single training plan template's full detail — the caller's own entry at any
/// visibility, or any trainer's <c>Public</c> entry.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetTrainingPlanTemplateEndpoint(IMongoContext mongo)
    : Endpoint<GetTrainingPlanTemplateRequest, TrainingPlanTemplateDetailDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/plan-templates/{TemplateId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get training plan template detail";
            s.Description = "Returns the full week tree for a template the caller owns, or any Public template.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainingPlanTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerId = Guid.Parse(userId);

        var template = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.TrainingPlanTemplates, req.TemplateId, callerId, TrainingPlanTemplateLibrary.Denial, ct);

        if (template is null)
        {
            return;
        }

        await Send.OkAsync(TrainingPlanTemplateDetailDto.FromDocument(template, callerId), ct);
    }
}
