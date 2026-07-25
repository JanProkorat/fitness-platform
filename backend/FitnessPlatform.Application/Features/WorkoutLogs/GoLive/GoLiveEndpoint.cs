using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.GoLive;

/// <summary>
/// Transitions an existing draft session execution to Live state by acquiring the Live session lock.
/// This endpoint is called when the client presses the Start button on the session intro page —
/// NOT on page mount. Separating log creation (POST /client/training/logs) from lock acquisition
/// fixes the timing issue where the "Probíhá trénink" badge fired on intro-page entry rather
/// than on Start press.
///
/// Requires that the execution already exists (created by StartWorkout) and that the session is
/// plan-bound (non-null PlanId + SessionId on the execution).
///
/// Returns 409 <c>session_locked</c> when the session is already in Editing state.
/// Emits <c>sessioneditlockchanged</c> (state=Live) to both client and trainer on successful acquire.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="lockService">Session lock service.</param>
/// <param name="lockOptions">Training lock TTL configuration.</param>
/// <param name="notifier">Realtime notifier for SignalR fan-out.</param>
public class GoLiveEndpoint(
    IMongoContext mongo,
    ISessionLockService lockService,
    IOptions<TrainingLockOptions> lockOptions,
    IRealtimeNotifier notifier) : Endpoint<GoLiveRequest, GoLiveResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/logs/{logId}/go-live");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Go live with a workout";
            s.Description = "Acquires the Live session lock for an existing draft session execution. " +
                            "Call this when the client actually presses Start, not on page mount.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GoLiveRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientUserIdGuid = Guid.Parse(userId);

        // Load the execution and verify ownership.
        var logFilter = Builders<SessionExecution>.Filter.Eq(w => w.ExternalId, req.LogId)
                        & Builders<SessionExecution>.Filter.Eq(w => w.ClientId, clientUserIdGuid)
                        & Builders<SessionExecution>.Filter.Exists(w => w.Performance)
                        & Builders<SessionExecution>.Filter.Eq(w => w.Status, SessionExecutionStatus.Partial);

        using var logCursor = await mongo.SessionExecutions.FindAsync(logFilter, cancellationToken: ct);
        var log = await logCursor.FirstOrDefaultAsync(ct);

        if (log is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // go-live is only meaningful for plan-bound sessions — ad-hoc workouts have no lock to acquire.
        if (!log.PlanId.HasValue || !log.SessionId.HasValue)
        {
            // Ad-hoc workout — no lock needed; return success so the client can proceed.
            await Send.OkAsync(new GoLiveResponse
            {
                LogId = log.ExternalId,
                LiveAt = DateTime.UtcNow
            }, ct);
            return;
        }

        // Resolve the training plan to get the trainer ID for fan-out.
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, log.PlanId.Value);
        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var liveTtl = TimeSpan.FromHours(lockOptions.Value.LiveTtlHours);

        // AcquireAsync clientId must be the ApplicationUser.Id — SignalR groups by user id,
        // not by ClientProfile.PublicId.
        var acquireResult = await lockService.AcquireAsync(
            log.SessionId.Value,
            log.PlanId.Value,
            clientUserIdGuid,
            plan.TrainerId,
            LockHolder.Client,
            LockType.Live,
            liveTtl,
            ct);

        if (acquireResult is AcquireResult.LockConflict)
        {
            // Session is currently in Editing state — emit nothing; no transition occurred.
            await this.SendProblemAsync(409, ErrorCodes.SessionLocked,
                "This session is locked and cannot be started right now.", ct);
            return;
        }

        var now = DateTime.UtcNow;

        // Broadcast state=Live AFTER the lock is acquired (and the execution already exists in Mongo).
        // Best-effort: broadcast failure must NOT fail the request.
        try
        {
            var payload = new SessionLockChangedPayload(
                log.PlanId.Value,
                log.SessionId.Value,
                "Live",
                "Client");

            await notifier.NotifyAsync(clientUserIdGuid, "sessioneditlockchanged", payload, ct);
            await notifier.NotifyAsync(plan.TrainerId, "sessioneditlockchanged", payload, ct);
        }
        catch
        {
            // Fan-out is best-effort — the lock acquire is authoritative.
        }

        await Send.OkAsync(new GoLiveResponse
        {
            LogId = log.ExternalId,
            LiveAt = now
        }, ct);
    }
}
