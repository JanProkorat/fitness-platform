using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.CopyTemplate;

/// <summary>
/// Clones any readable training plan template (the caller's own, or any trainer's <c>Public</c>
/// entry) into a new <c>Private</c> template owned by the caller, with a fresh <c>ExternalId</c>.
/// Read-guarded, not write-guarded — another owner's <c>Public</c> template must stay copyable
/// even though this endpoint writes a new document.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class CopyTrainingPlanTemplateEndpoint(IMongoContext mongo, TimeProvider timeProvider) : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plan-templates/{TemplateId}/copy");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Copy a training plan template";
            s.Description = "Clones any readable template into a new Private template owned by the caller.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerId = Guid.Parse(userId);
        var templateId = Route<Guid>("TemplateId");

        var source = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.TrainingPlanTemplates, templateId, callerId, TrainingPlanTemplateLibrary.Denial, ct);

        if (source is null)
        {
            return;
        }

        var clonedWeeks = TemplateContentCloner.CloneWeeksAsTemplate(source.Weeks);

        var copy = new TrainingPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = callerId,
            Name = source.Name,
            Description = source.Description,
            Goal = source.Goal,
            Difficulty = source.Difficulty,
            Weeks = clonedWeeks,
            WeekCount = clonedWeeks.Count,
            Visibility = LibraryVisibility.Private,
            Version = 1,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime
        };

        await mongo.TrainingPlanTemplates.InsertOneAsync(copy, cancellationToken: ct);

        await HttpContext.Response.SendAsync(
            TrainingPlanTemplateSummaryDto.FromDocument(copy, callerId), 201, cancellation: ct);
    }
}
