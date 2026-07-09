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
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.PublishTrainingWeek;

/// <summary>
/// Publishes a single week of a training plan, making it visible to the client.
/// Archives other active training plans for the same client when the first week is published.
/// Defensively clears any stale Editing lock docs for the week's sessions on publish.
/// </summary>
public class PublishTrainingWeekEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    ISessionLockService lockService,
    PlanConcurrencyGuard guard) : Endpoint<PublishTrainingWeekRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plans/{PlanId}/weeks/{WeekNumber}/publish");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Publish a week of a training plan";
            s.Description = "Sets the week's status to Published. Archives other active training plans for the same client. " +
                            "Clears any stale Editing lock docs for the week's sessions.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PublishTrainingWeekRequest req, CancellationToken ct)
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

        // Computed inside the mutate delegate BEFORE the mutation (reflects pre-publish state);
        // consumed after a confirmed successful replace to decide whether to archive siblings.
        var hadPublishedWeeks = false;

        var guardResult = await guard.ReplaceWithVersionGuardAsync(
            mongo.TrainingPlans,
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
                plan.Status = TrainingPlanStatus.Active;
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
                    "Version conflict. The plan was modified by another request.", ct);
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
            var archiveFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, plan.ClientId)
                                & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active)
                                & Builders<TrainingPlan>.Filter.Ne(p => p.ExternalId, plan.ExternalId);

            var archiveUpdate = Builders<TrainingPlan>.Update
                .Set(p => p.Status, TrainingPlanStatus.Archived)
                .Set(p => p.DateUpdated, DateTime.UtcNow);

            await mongo.TrainingPlans.UpdateManyAsync(archiveFilter, archiveUpdate, cancellationToken: ct);
        }

        // Defensive cleanup: clear any stale Editing lock docs for the week's sessions.
        // This handles the edge case where a trainer had a session unlocked just before publish.
        // ReleaseAsync is idempotent — safe to call even if no lock exists.
        // Only emit sessioneditlockchanged when ReleaseAsync returns true — emitting Stable
        // for a session that had no lock would be spurious fan-out.
        var week = plan.Weeks.First(w => w.WeekNumber == req.WeekNumber);
        var weekSessionIds = week.Sessions.Select(s => s.SessionId).ToList();
        foreach (var sessionId in weekSessionIds)
        {
            var released = await lockService.ReleaseAsync(sessionId, LockHolder.Coach, LockType.Editing, ct);

            if (released)
            {
                var lockPayload = new SessionLockChangedPayload(
                    plan.ExternalId,
                    sessionId,
                    "Stable",
                    "Coach");

                await notifier.NotifyAsync(plan.ClientId, "sessioneditlockchanged", lockPayload, ct);
                await notifier.NotifyAsync(trainerId, "sessioneditlockchanged", lockPayload, ct);
            }
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
                "Training plan updated",
                $"Week {req.WeekNumber} of your training plan has been published.",
                ct: ct);

            await notifier.NotifyAsync(clientProfile.UserId, "trainingplanpublished", new
            {
                PlanId = plan.ExternalId,
                PlanName = plan.Name,
                req.WeekNumber,
                StartDate = plan.StartDate,
            }, ct);
        }

        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan), ct);
    }
}
