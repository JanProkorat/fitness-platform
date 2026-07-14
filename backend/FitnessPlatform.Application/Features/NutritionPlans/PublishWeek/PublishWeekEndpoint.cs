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

namespace FitnessPlatform.Application.Features.NutritionPlans.PublishWeek;

/// <summary>
/// Publishes a single week of a nutrition plan, making it visible to the client.
/// Archives other active plans for the same client when the first week is published.
/// </summary>
public class PublishWeekEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    PlanConcurrencyGuard guard) : Endpoint<PublishWeekRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plans/{PlanId}/weeks/{WeekNumber}/publish");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Publish a week of a nutrition plan";
            s.Description = "Sets the week's status to Published. Archives other active plans for the same client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PublishWeekRequest req, CancellationToken ct)
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

        // Computed inside the mutate delegate BEFORE the mutation (reflects pre-publish state);
        // consumed after a confirmed successful replace to decide whether to archive siblings.
        var hadPublishedWeeks = false;

        var guardResult = await guard.ReplaceWithVersionGuardAsync(
            mongo.NutritionPlans,
            lookupFilter,
            replaceFilter,
            req.Version,
            p => p.Version,
            (plan, _) =>
            {
                var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);
                if (week is null)
                {
                    ThrowError($"Week {req.WeekNumber} not found in plan.");
                    return Task.FromResult(false);
                }

                if (week.Status == WeekStatus.Published)
                {
                    ThrowError($"Week {req.WeekNumber} is already published.");
                    return Task.FromResult(false);
                }

                // Start date must be set before publishing
                if (!plan.StartDate.HasValue)
                {
                    ThrowError(ErrorCodes.StartDateRequired, "Start date must be set before publishing a week.");
                    return Task.FromResult(false);
                }

                // The target week's Monday must not be in the past
                var weekStartDate = DateOnly.FromDateTime(plan.StartDate.Value.AddDays((req.WeekNumber - 1) * 7));
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                if (weekStartDate < today)
                {
                    ThrowError(ErrorCodes.WeekStartInPast, $"Week {req.WeekNumber} starts on {weekStartDate}, which is in the past.");
                    return Task.FromResult(false);
                }

                // Check if this is the first published week — if so, archive other active plans
                // afterward. Computed BEFORE the mutation below so it reflects pre-publish state.
                hadPublishedWeeks = plan.Weeks.Any(w => w.Status == WeekStatus.Published);

                // Publish the week
                week.Status = WeekStatus.Published;
                week.DatePublished = DateTime.UtcNow;
                plan.Status = NutritionPlanStatus.Active;
                plan.DateUpdated = DateTime.UtcNow;
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

        // Now that the publish itself is confirmed, archive other active plans if this was
        // the first published week.
        if (!hadPublishedWeeks)
        {
            var archiveFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, plan.ClientId)
                                & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active)
                                & Builders<NutritionPlan>.Filter.Ne(p => p.ExternalId, plan.ExternalId);

            var archiveUpdate = Builders<NutritionPlan>.Update
                .Set(p => p.Status, NutritionPlanStatus.Archived)
                .Set(p => p.DateUpdated, DateTime.UtcNow);

            await mongo.NutritionPlans.UpdateManyAsync(archiveFilter, archiveUpdate, cancellationToken: ct);
        }

        // Notify the client about the published week
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == plan.ClientId, ct);

        if (clientProfile is not null)
        {
            await notificationService.CreateAsync(
                clientProfile.UserId,
                NotificationType.PlanPublished,
                new Dictionary<string, string> { ["weekNumber"] = req.WeekNumber.ToString() },
                variant: NotificationTemplates.PlanPublishedNutritionPublished,
                ct: ct);

            await notifier.NotifyAsync(clientProfile.UserId, "nutritionplanpublished", new
            {
                PlanId = plan.ExternalId,
                req.WeekNumber,
            }, ct);
        }

        await Send.OkAsync(GetPlanResponse.FromDocument(plan), ct);
    }
}
