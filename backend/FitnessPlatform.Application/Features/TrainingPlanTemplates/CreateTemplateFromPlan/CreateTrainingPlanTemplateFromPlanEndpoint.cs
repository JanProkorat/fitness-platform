using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.CreateTemplateFromPlan;

/// <summary>
/// Saves an existing training plan as a new template owned by the caller, stripping every
/// client-only field (<c>ClientId</c>, <c>Status</c>, <c>StartDate</c>, publish/complete dates,
/// <c>QuestionnaireResponseId</c>, <c>TargetWeightKg</c>). <see cref="TrainingPlan"/> carries no
/// <c>Difficulty</c> field, so the new template's <c>Difficulty</c> is left <c>null</c> — the
/// caller sets it later via <c>PUT</c>.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class CreateTrainingPlanTemplateFromPlanEndpoint(IMongoContext mongo, TimeProvider timeProvider)
    : Endpoint<CreateTemplateFromPlanRequest, TrainingPlanTemplateSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plan-templates/from-plan");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Save a training plan as a template";
            s.Description = "Copies an existing plan's content into a new template, dropping client-only fields.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateTemplateFromPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var ownerId = Guid.Parse(userId);

        // TrainingPlan is not an ILibraryDocument, so ownership is checked directly against
        // TrainerId in the fetch filter — a missing plan and an unowned plan are
        // indistinguishable, both routed through the same shaped 404 this library uses.
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, ownerId);

        using var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await this.SendLibraryNotFoundAsync(TrainingPlanTemplateLibrary.Denial, ct);
            return;
        }

        var weeks = TemplateContentCloner.CloneWeeksFromPlan(plan.Weeks);

        var template = new TrainingPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = req.Name,
            Description = req.Description,
            Goal = plan.Goal,
            Weeks = weeks,
            WeekCount = weeks.Count,
            Visibility = req.Visibility,
            Version = 1,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime
        };

        await mongo.TrainingPlanTemplates.InsertOneAsync(template, cancellationToken: ct);

        await HttpContext.Response.SendAsync(
            TrainingPlanTemplateSummaryDto.FromDocument(template), 201, cancellation: ct);
    }
}
