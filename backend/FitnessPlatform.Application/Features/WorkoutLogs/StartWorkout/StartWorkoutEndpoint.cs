using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
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
/// <param name="db">Relational database context — used to resolve the caller's ClientProfile.PublicId.</param>
/// <param name="lockService">Session lock service.</param>
/// <param name="lockOptions">Training lock TTL configuration.</param>
/// <param name="notifier">Realtime notifier for SignalR fan-out.</param>
public class StartWorkoutEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
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

        // clientUserIdGuid is the ApplicationUser.Id (what JWT AppClaims.UserId stores).
        // It is used for:
        //   1. WorkoutLog.ClientId — the log is owned by the user id.
        //   2. AcquireAsync clientId arg — SignalR groups connections by ApplicationUser.Id,
        //      so realtime events (sessioneditlockchanged) must target the user id, not the profile id.
        var clientUserIdGuid = Guid.Parse(userId);
        var now = DateTime.UtcNow;

        // ── Live lock acquisition (plan-bound workouts only) ──────────────────────
        // Ad-hoc workouts (null PlanId or null SessionId) skip the lock entirely —
        // there is no session to gate and no trainer who could be editing.
        if (req.PlanId.HasValue && req.SessionId.HasValue)
        {
            // Resolve the caller's ClientProfile.PublicId — this is what TrainingPlan.ClientId stores.
            // (TrainingPlan.ClientId = ClientProfile.PublicId, NOT ApplicationUser.Id.)
            var clientProfile = await db.ClientProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(cp => cp.UserId == clientUserIdGuid, ct);

            if (clientProfile is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            var profilePublicId = clientProfile.PublicId;

            // Load the plan to resolve trainerId and validate ownership.
            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId.Value);
            using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var plan = await planCursor.FirstOrDefaultAsync(ct);

            if (plan is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            // Ownership check: TrainingPlan.ClientId holds the ClientProfile.PublicId.
            // Compare against the resolved publicId, NOT the ApplicationUser.Id.
            if (plan.ClientId != profilePublicId)
            {
                await Send.ForbiddenAsync(ct);
                return;
            }

            var liveTtl = TimeSpan.FromHours(lockOptions.Value.LiveTtlHours);
            // AcquireAsync clientId must be the ApplicationUser.Id (clientUserIdGuid), not the
            // profile PublicId — SessionLock.ClientId feeds SignalR fan-out via IRealtimeNotifier
            // which routes by ApplicationUser.Id (NotificationHub groups connections by user id).
            var acquireResult = await lockService.AcquireAsync(
                req.SessionId.Value,
                req.PlanId.Value,
                clientUserIdGuid,
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

                await notifier.NotifyAsync(clientUserIdGuid, "sessioneditlockchanged", payload, ct);
                await notifier.NotifyAsync(plan.TrainerId, "sessioneditlockchanged", payload, ct);
            }
        }

        var log = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserIdGuid,
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
