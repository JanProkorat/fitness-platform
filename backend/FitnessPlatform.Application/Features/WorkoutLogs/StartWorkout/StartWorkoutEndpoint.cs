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

namespace FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;

/// <summary>
/// Starts a new workout session for the authenticated client.
/// When the request references a plan + session (non-ad-hoc workouts),
/// acquires a <c>Live</c> lock on the session before creating the log.
/// Returns 409 <c>session_locked</c> when the session is in <c>Editing</c> state.
/// Ad-hoc workouts (null PlanId or null SessionId) skip the lock entirely.
/// Emits <c>sessioneditlockchanged</c> (state=Live) to both client and trainer on successful acquire.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="lockService">Session lock service.</param>
/// <param name="lockOptions">Training lock TTL configuration.</param>
/// <param name="notifier">Realtime notifier for SignalR fan-out.</param>
public class StartWorkoutEndpoint(
    IMongoContext mongo,
    ISessionLockService lockService,
    IOptions<TrainingLockOptions> lockOptions,
    IRealtimeNotifier notifier) : Endpoint<StartWorkoutRequest, StartWorkoutResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/logs");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Start a workout";
            s.Description = "Creates a new empty workout log and returns its ID for progressive logging. " +
                            "Acquires a Live lock on the session when PlanId and SessionId are provided.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(StartWorkoutRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);
        var now = DateTime.UtcNow;

        // ── Live lock acquisition (plan-bound workouts only) ──────────────────────
        // Ad-hoc workouts (null PlanId or null SessionId) skip the lock entirely —
        // there is no session to gate and no trainer who could be editing.
        if (req.PlanId.HasValue && req.SessionId.HasValue)
        {
            // Load the plan to resolve trainerId and validate ownership.
            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId.Value);
            using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var plan = await planCursor.FirstOrDefaultAsync(ct);

            if (plan is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            // Ownership check: the plan must belong to this client.
            if (plan.ClientId != clientId)
            {
                await Send.ForbiddenAsync(ct);
                return;
            }

            var liveTtl = TimeSpan.FromHours(lockOptions.Value.LiveTtlHours);
            var acquireResult = await lockService.AcquireAsync(
                req.SessionId.Value,
                req.PlanId.Value,
                clientId,
                plan.TrainerId,
                LockHolder.Client,
                LockType.Live,
                liveTtl,
                ct);

            if (acquireResult is AcquireResult.LockConflict)
            {
                // 409 conflict path — emit nothing; no state transition occurred.
                await this.SendProblemAsync(409, ErrorCodes.SessionLocked,
                    "This session is locked and cannot be started right now.", ct);
                return;
            }

            // Emit sessioneditlockchanged (state=Live) to both parties on successful acquire.
            // Broadcast after the lock is held but before the log is persisted so clients
            // see the state update as soon as the lock is confirmed.
            if (acquireResult is AcquireResult.Acquired)
            {
                var payload = new SessionLockChangedPayload(
                    req.PlanId!.Value,
                    req.SessionId!.Value,
                    "Live",
                    "Client");

                await notifier.NotifyAsync(clientId, "sessioneditlockchanged", payload, ct);
                await notifier.NotifyAsync(plan.TrainerId, "sessioneditlockchanged", payload, ct);
            }
        }

        var log = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            PlanId = req.PlanId,
            SessionId = req.SessionId,
            StartedAt = now,
            IsCompleted = false,
            Sections = [],
            DateCreated = now
        };

        await mongo.WorkoutLogs.InsertOneAsync(log, cancellationToken: ct);

        await HttpContext.Response.SendAsync(new StartWorkoutResponse
        {
            LogId = log.ExternalId,
            StartedAt = now
        }, 201, cancellation: ct);
    }
}
