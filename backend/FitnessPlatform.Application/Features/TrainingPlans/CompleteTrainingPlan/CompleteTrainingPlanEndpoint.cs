using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
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
    IRealtimeNotifier notifier,
    PlanConcurrencyGuard guard,
    ProfessionalAuthHelper authHelper) : Endpoint<CompleteTrainingPlanRequest, GetTrainingPlanResponse>
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

        var lookupFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);
        var replaceFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<TrainingPlan>.Filter.Eq(p => p.Version, req.Version);

        var guardResult = await guard.ReplaceWithVersionGuardAsync(
            mongo.TrainingPlans,
            lookupFilter,
            replaceFilter,
            req.Version,
            p => p.Version,
            (plan, authorizeCt) => AuthorizeAsync(plan, trainerId, authorizeCt),
            (plan, _) =>
            {
                // Only active plans can be completed
                if (plan.Status != TrainingPlanStatus.Active)
                {
                    ThrowError(ErrorCodes.PlanNotActive, "Only active plans can be completed.");
                    return Task.FromResult(false);
                }

                // Mark as completed
                var now = DateTime.UtcNow;
                plan.Status = TrainingPlanStatus.Completed;
                plan.DateCompleted = now;
                plan.DateUpdated = now;
                plan.Version += 1;

                return Task.FromResult(true);
            },
            ct);

        switch (guardResult.Outcome)
        {
            case PlanConcurrencyOutcome.NotFound:
                await Send.NotFoundAsync(ct);
                return;
            case PlanConcurrencyOutcome.VersionConflict:
                await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                    "Version conflict. The plan was modified by another request.", ct);
                return;
            case PlanConcurrencyOutcome.ReplaceConflict:
                await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                    "Version conflict. The plan was modified by another request.", ct);
                return;
            case PlanConcurrencyOutcome.HandledByMutator:
                // The authorize delegate already wrote its 404.
                return;
        }

        var plan = guardResult.Document!;

        // Notify the client — TrainingPlan.ClientId is ApplicationUser.Id (#840).
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == plan.ClientId, ct);

        if (clientProfile is not null)
        {
            await notificationService.CreateAsync(
                clientProfile.UserId,
                NotificationType.PlanPublished,
                new Dictionary<string, string> { ["planName"] = plan.Name },
                variant: NotificationTemplates.PlanPublishedTrainingCompleted,
                ct: ct);

            await notifier.NotifyAsync(clientProfile.UserId, "trainingplancompleted", new
            {
                PlanId = plan.ExternalId,
                plan.Name,
            }, ct);
        }

        // Response ClientId must stay the client-facing ClientProfile.PublicId (pre-#840
        // contract) — reuse the profile already resolved above instead of a second lookup.
        var clientPublicId = clientProfile?.PublicId ?? plan.ClientId;
        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan, clientPublicId), ct);
    }

    /// <summary>
    /// The lookup filter proved authorship, which is permanent. Access is not — require the
    /// caller's link to the plan's client to still grant training access. Runs before the
    /// guard's version comparison so a denial is indistinguishable from a missing plan.
    /// </summary>
    private async Task<bool> AuthorizeAsync(TrainingPlan plan, Guid trainerId, CancellationToken ct)
    {
        if (await authHelper.HasPlanAccessForClientUserAsync(
                trainerId, plan.ClientId, requireTrainingPlanAccess: true, ct))
        {
            return true;
        }

        await Send.NotFoundAsync(ct);
        return false;
    }
}
