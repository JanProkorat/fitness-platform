using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.AbandonWorkout;

/// <summary>
/// Abandons (discards) a draft workout session by releasing the Live session lock.
/// Does NOT mark the log as completed and does NOT delete it — the caller (mobile)
/// owns clearing local state. The log remains as an incomplete draft in Mongo.
///
/// Idempotent: if no Live lock is held (already released, expired, or session was ad-hoc),
/// returns 200 with no broadcast. Only emits <c>sessioneditlockchanged</c> (state=Stable)
/// to both client and trainer when a lock was actually released (ReleaseAsync returns true)
/// AND the log's PlanId resolves a training plan (avoids spurious fan-out).
///
/// Broadcast failure is non-fatal — the release is authoritative.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="lockService">Session lock service.</param>
/// <param name="notifier">Realtime notifier for SignalR fan-out.</param>
public class AbandonWorkoutEndpoint(
    IMongoContext mongo,
    ISessionLockService lockService,
    IRealtimeNotifier notifier) : Endpoint<AbandonWorkoutRequest, AbandonWorkoutResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/logs/{logId}/abandon");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Abandon a workout";
            s.Description = "Releases the Live session lock for a draft workout log. " +
                            "Idempotent: returns 200 when no lock is held. " +
                            "Does not delete the log or mark it completed.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AbandonWorkoutRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientUserIdGuid = Guid.Parse(userId);

        // Load the execution — must belong to the caller, carry Performance, and be incomplete.
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

        // For ad-hoc workouts or logs without a session, no lock was ever acquired.
        // Return idempotent success immediately — no broadcast.
        if (!log.SessionId.HasValue)
        {
            await Send.OkAsync(new AbandonWorkoutResponse { Released = false }, ct);
            return;
        }

        // Release the Live lock. ReleaseAsync is idempotent — returns false when no lock
        // was held (already released, expired, or 6h TTL elapsed). Not an error.
        var released = await lockService.ReleaseAsync(log.SessionId.Value, LockHolder.Client, LockType.Live, ct);

        // Only emit sessioneditlockchanged when we actually released a lock AND the plan resolves
        // a trainer to fan out to. Spurious Stable broadcasts on unlocked sessions are wrong.
        if (released && log.PlanId.HasValue)
        {
            // Resolve the training plan to get the trainer ID for fan-out.
            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, log.PlanId.Value);
            using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var plan = await planCursor.FirstOrDefaultAsync(ct);

            if (plan is not null)
            {
                // Broadcast is best-effort — failure must NOT fail the request.
                try
                {
                    var payload = new SessionLockChangedPayload(
                        log.PlanId.Value,
                        log.SessionId.Value,
                        "Stable",
                        "Client");

                    await notifier.NotifyAsync(clientUserIdGuid, "sessioneditlockchanged", payload, ct);
                    await notifier.NotifyAsync(plan.TrainerId, "sessioneditlockchanged", payload, ct);
                }
                catch
                {
                    // Fan-out is best-effort — the lock release is authoritative.
                }
            }
        }

        await Send.OkAsync(new AbandonWorkoutResponse { Released = released }, ct);
    }
}
