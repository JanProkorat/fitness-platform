using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.DeleteTrainingPlan;

/// <summary>
/// Soft-deletes a training plan by setting its status to Archived.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class DeleteTrainingPlanEndpoint(IMongoContext mongo) : Endpoint<DeleteTrainingPlanRequest>
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

        // Verify ownership
        var findFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.TrainingPlans.FindAsync(findFilter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.TrainerId != trainerId)
        {
            await Send.NotFoundAsync(ct);
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
