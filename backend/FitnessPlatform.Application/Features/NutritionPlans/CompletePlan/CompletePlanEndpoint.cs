using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.CompletePlan;

/// <summary>
/// Marks an active nutrition plan as completed, ending its lifecycle.
/// Only the owning nutritionist can complete a plan, and only if the plan is currently Active.
/// </summary>
public class CompletePlanEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    PlanConcurrencyGuard guard) : Endpoint<CompletePlanRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plans/{PlanId}/complete");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Complete a nutrition plan";
            s.Description = "Marks an active nutrition plan as completed. The plan must be in Active status.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CompletePlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var lookupFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);
        var replaceFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var guardResult = await guard.ReplaceWithVersionGuardAsync(
            mongo.NutritionPlans,
            lookupFilter,
            replaceFilter,
            req.Version,
            p => p.Version,
            (plan, _) =>
            {
                // Only active plans can be completed
                if (plan.Status != NutritionPlanStatus.Active)
                {
                    ThrowError(ErrorCodes.PlanNotActive, "Only active plans can be completed.");
                    return Task.FromResult(false);
                }

                // Mark as completed
                var now = DateTime.UtcNow;
                plan.Status = NutritionPlanStatus.Completed;
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
                    "Version conflict. The plan was modified concurrently.", ct);
                return;
            case PlanConcurrencyOutcome.HandledByMutator:
                // Never reached: this endpoint's mutate delegate never writes a response directly.
                return;
        }

        var plan = guardResult.Document!;

        // Notify the client
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == plan.ClientId, ct);

        if (clientProfile is not null)
        {
            await notificationService.CreateAsync(
                clientProfile.UserId,
                NotificationType.PlanPublished,
                new Dictionary<string, string> { ["planName"] = plan.Name },
                variant: NotificationTemplates.PlanPublishedNutritionCompleted,
                ct: ct);

            await notifier.NotifyAsync(clientProfile.UserId, "nutritionplancompleted", new
            {
                PlanId = plan.ExternalId,
                plan.Name,
            }, ct);
        }

        await Send.OkAsync(GetPlanResponse.FromDocument(plan), ct);
    }
}
