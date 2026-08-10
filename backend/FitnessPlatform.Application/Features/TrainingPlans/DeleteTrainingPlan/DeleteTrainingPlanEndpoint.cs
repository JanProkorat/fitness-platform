using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.DeleteTrainingPlan;

/// <summary>
/// Soft-deletes a training plan by setting its status to Archived.
/// </summary>
/// <remarks>
/// Intentionally does not go through <see cref="FitnessPlatform.Application.Domain.Services.PlanConcurrencyGuard"/> —
/// this update scopes only by ExternalId + owner and never compares a caller-supplied
/// version, so there is no version-conflict branch for the guard to encapsulate. See the
/// guard's class doc-comment for the full Create/Delete exclusion rationale (#659 / #695).
/// </remarks>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Link capability helper — authorship identifies the plan, the caller's
/// live link to its client decides access.</param>
public class DeleteTrainingPlanEndpoint(IMongoContext mongo, ProfessionalAuthHelper authHelper)
    : Endpoint<DeleteTrainingPlanRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/training/plans/{PlanId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Delete a training plan";
            s.Description = "Soft-deletes a plan by archiving it. The data is preserved but no longer active.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Verify authorship AND that the caller's link to the plan's client still grants
        // training access.
        var plan = await this.LoadOwnedTrainingPlanIfAllowedAsync(mongo, authHelper, req.PlanId, trainerId, ct);

        if (plan is null)
        {
            return;
        }

        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);

        var update = Builders<TrainingPlan>.Update
            .Set(p => p.Status, TrainingPlanStatus.Archived)
            .Set(p => p.DateUpdated, DateTime.UtcNow)
            .Inc(p => p.Version, 1);

        await mongo.TrainingPlans.UpdateOneAsync(filter, update, cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
