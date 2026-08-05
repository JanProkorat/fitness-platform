using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.CreateTemplate;

/// <summary>
/// Creates a new training plan template for the authenticated trainer, either empty
/// (materialized from a week count) or with a full week tree supplied directly.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class CreateTrainingPlanTemplateEndpoint(IMongoContext mongo, TimeProvider timeProvider)
    : Endpoint<CreateTemplateRequest, TrainingPlanTemplateSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plan-templates");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Create a training plan template";
            s.Description = "Creates a template owned by the caller, either empty or with a supplied week tree.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var ownerId = Guid.Parse(userId);

        var weeks = req.Weeks is { Count: > 0 }
            ? TemplateRequestMapper.ToWeeks(req.Weeks)
            : TemplateRequestMapper.ToEmptyWeeks(req.WeekCount!.Value);

        var template = new TrainingPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = req.Name,
            Description = req.Description,
            Goal = req.Goal,
            Difficulty = req.Difficulty,
            Weeks = weeks,
            WeekCount = weeks.Count,
            Visibility = req.Visibility,
            Version = 1,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime
        };

        await mongo.TrainingPlanTemplates.InsertOneAsync(template, cancellationToken: ct);

        await HttpContext.Response.SendAsync(
            TrainingPlanTemplateSummaryDto.FromDocument(template, ownerId), 201, cancellation: ct);
    }
}
