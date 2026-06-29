using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
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
    IRealtimeNotifier notifier) : Endpoint<CompletePlanRequest, GetPlanResponse>
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

        // Fetch plan owned by this nutritionist
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
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
        if (plan.Status != NutritionPlanStatus.Active)
        {
            ThrowError(ErrorCodes.PlanNotActive, "Only active plans can be completed.");
            return;
        }

        // Mark as completed
        var now = DateTime.UtcNow;
        plan.Status = NutritionPlanStatus.Completed;
        plan.DateCompleted = now;
        plan.DateUpdated = now;
        plan.Version += 1;

        var versionFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.NutritionPlans.ReplaceOneAsync(versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                "Version conflict. The plan was modified concurrently.", ct);
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
                "Nutrition plan completed",
                $"Your nutrition plan \"{plan.Name}\" has been marked as completed.",
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
