using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.CompleteTrainingPlan;

/// <summary>
/// Marks an active training plan as completed, ending its lifecycle.
/// Only the owning trainer can complete a plan, and only if the plan is currently Active.
/// </summary>
public class CompleteTrainingPlanEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    INotificationService notificationService,
    IRealtimeNotifier notifier) : Endpoint<CompleteTrainingPlanRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plans/{PlanId}/complete");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Complete a training plan";
            s.Description = "Marks an active training plan as completed. The plan must be in Active status.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CompleteTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Fetch plan owned by this trainer
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);

        var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Version check
        if (plan.Version != req.Version)
        {
            await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                "Version conflict. The plan was modified by another request.", ct);
            return;
        }

        // Only active plans can be completed
        if (plan.Status != TrainingPlanStatus.Active)
        {
            ThrowError(ErrorCodes.PlanNotActive, "Only active plans can be completed.");
            return;
        }

        // Mark as completed
        var now = DateTime.UtcNow;
        plan.Status = TrainingPlanStatus.Completed;
        plan.DateCompleted = now;
        plan.DateUpdated = now;
        plan.Version += 1;

        var versionFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<TrainingPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.TrainingPlans.ReplaceOneAsync(versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                "Version conflict. The plan was modified by another request.", ct);
            return;
        }

        // Notify the client
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == plan.ClientId, ct);

        if (clientProfile is not null)
        {
            await notificationService.CreateAsync(
                clientProfile.UserId,
                NotificationType.PlanPublished,
                "Training plan completed",
                $"Your training plan \"{plan.Name}\" has been marked as completed.",
                ct: ct);

            await notifier.NotifyAsync(clientProfile.UserId, "trainingPlanCompleted", new
            {
                PlanId = plan.ExternalId,
                plan.Name,
            }, ct);
        }

        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan), ct);
    }
}
