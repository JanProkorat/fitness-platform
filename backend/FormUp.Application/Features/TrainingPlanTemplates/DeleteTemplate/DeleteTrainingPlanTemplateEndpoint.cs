using FormUp.Application.Domain.Authorization;
using FormUp.Application.Domain.Enums;
using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Extensions;
using FormUp.Application.Features.TrainingPlanTemplates.Shared;
using FormUp.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FormUp.Application.Features.TrainingPlanTemplates.DeleteTemplate;

/// <summary>
/// Hard-deletes a training plan template. Owner-only — readable-but-not-owned (another owner's
/// Public entry) returns 403; unreadable (another owner's Private entry) returns 404,
/// indistinguishable from a genuinely missing template.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
[RemovedCoachRole(AppRoles.Trainer, RemovedCoachRoleMode.Refuse)]
public class DeleteTrainingPlanTemplateEndpoint(IMongoContext mongo) : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/training/plan-templates/{templateId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Delete a training plan template";
            s.Description = "Hard-deletes the template. Owner-only.";
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

        var ownerId = Guid.Parse(userId);
        var templateId = Route<Guid>("templateId");

        var template = await this.LoadLibraryEntryForWriteOrRespondAsync(
            mongo.TrainingPlanTemplates, templateId, ownerId, TrainingPlanTemplateLibrary.Denial, ct);

        if (template is null)
        {
            return;
        }

        await mongo.TrainingPlanTemplates.DeleteOneAsync(
            Builders<TrainingPlanTemplate>.Filter.Eq(t => t.ExternalId, template.ExternalId), ct);

        await Send.NoContentAsync(ct);
    }
}
