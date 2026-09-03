using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkWorkoutComplete;

/// <summary>
/// Marks a single workout within a session as complete for the client on the specified date.
/// Intended for workouts that have no exercises (e.g. a ForTime "Running" workout) where
/// exercise-level tracking is not applicable.
/// Idempotent: re-completing an already-complete workout returns success without side effects.
/// Uses optimistic concurrency on the <see cref="SessionExecution"/> document.
/// Slides the Live lock TTL forward (keep-alive) when a Live lock exists for this session.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="lockService">Session lock service — used to refresh the Live TTL on activity.</param>
/// <param name="lockOptions">Training lock TTL configuration.</param>
/// <param name="linkAuthorizationService">Link capability service for the trainer-progress broadcast.</param>
/// <param name="logger">Logger.</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class MarkWorkoutCompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    ISessionLockService lockService,
    IOptions<TrainingLockOptions> lockOptions,
    IClientLinkAuthorizationService linkAuthorizationService,
    ILogger<MarkWorkoutCompleteEndpoint> logger,
    TimeProvider timeProvider)
    : Endpoint<MarkWorkoutCompleteRequest, MarkWorkoutCompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/sessions/{SessionId}/workouts/{WorkoutId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark a workout complete";
            s.Description = "Marks a workout within a training session as complete for the specified date. " +
                            "Used for exercise-free workouts (ForTime, etc.). Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkWorkoutCompleteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // req.CompletedOn is never populated by the client in practice — the fallback resolves
        // the CLIENT's local calendar day (#935) rather than the server's UTC day.
        var targetDate = (req.CompletedOn ?? DateOnly.FromDateTime(await db.ResolveClientLocalDateUtcAsync(clientId, timeProvider.GetUtcNow().UtcDateTime, ct)))
            .ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Resolve the client's Active training plan whose date window contains today (and
        // validate session/section ownership) — a client may hold several sequential,
        // non-overlapping Active plans (#780).
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                         & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, targetDate);

        if (plan is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.NoActiveTrainingPlan, "No active training plan found.", ct);
            return;
        }

        var session = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingSessionNotFound, "The session was not found in the active training plan.", ct);
            return;
        }

        // Slide the Live lock TTL forward — keep-alive for active workout sessions.
        // Called after ownership is confirmed so a caller cannot slide a TTL on a session
        // that does not belong to them.
        // Safe no-op when no Live lock exists (returns false).
        await lockService.RefreshAsync(req.SessionId, LockType.Live,
            TimeSpan.FromHours(lockOptions.Value.LiveTtlHours), ct);

        var workout = session.Workouts.FirstOrDefault(w => w.WorkoutId == req.WorkoutId);
        if (workout is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingWorkoutNotFound, "The workout was not found in the specified session.", ct);
            return;
        }

        var totalExercises = session.AllExercises.Count;

        // Load or create the execution document for (clientId, date, sessionId)
        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<SessionExecution>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<SessionExecution>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
        var existing = await executionCursor.FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            // Idempotency: already complete — return success immediately
            if ((existing.CompletedWorkoutIds ?? []).Contains(req.WorkoutId))
            {
                await Send.OkAsync(BuildResponse(req.SessionId, req.WorkoutId, targetDate, existing, totalExercises), ct);
                return;
            }

            // Optimistic concurrency check when updating an existing document
            if (req.Version.HasValue && existing.Version != req.Version.Value)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            var newSectionIds = new List<Guid>(existing.CompletedWorkoutIds ?? []) { req.WorkoutId };
            var newVersion = existing.Version + 1;

            var versionedFilter = executionFilter
                                  & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);

            var update = Builders<SessionExecution>.Update
                .Set(c => c.CompletedWorkoutIds, newSectionIds)
                .Set(c => c.DateUpdated, DateTime.UtcNow)
                .Set(c => c.Version, newVersion);

            var updateResult = await mongo.SessionExecutions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

            if (updateResult.ModifiedCount == 0)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            existing.CompletedWorkoutIds = newSectionIds;
            existing.Version = newVersion;

            await TrainingProgressBroadcaster.BroadcastSessionAsync(
                notifier, compliance, mongo, linkAuthorizationService, plan, clientId,
                req.SessionId, DateOnly.FromDateTime(targetDate),
                existing.CompletedExerciseInstanceIds.Count, totalExercises,
                logger, ct,
                workoutId: req.WorkoutId, workoutComplete: true);

            await Send.OkAsync(BuildResponse(req.SessionId, req.WorkoutId, targetDate, existing, totalExercises), ct);
        }
        else
        {
            // Create a new execution document
            var execution = new SessionExecution
            {
                ExternalId = Guid.NewGuid(),
                ClientId = clientId,
                PlanId = plan.ExternalId,
                Date = targetDate,
                SessionId = req.SessionId,
                CompletedExerciseInstanceIds = [],
                CompletedWorkoutIds = [req.WorkoutId],
                DateCreated = DateTime.UtcNow,
                Version = 1
            };

            try
            {
                await mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: ct);
            }
            catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError?.Code == 11000)
            {
                // Duplicate-key: a concurrent request inserted the document first.
                // Re-read and retry the update path once.
                using var retryCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
                existing = await retryCursor.FirstOrDefaultAsync(ct);

                if (existing is null)
                {
                    // Genuinely unexpected — let the global exception handler return 500.
                    throw;
                }

                if ((existing.CompletedWorkoutIds ?? []).Contains(req.WorkoutId))
                {
                    await Send.OkAsync(BuildResponse(req.SessionId, req.WorkoutId, targetDate, existing, totalExercises), ct);
                    return;
                }

                var retryIds = new List<Guid>(existing.CompletedWorkoutIds ?? []) { req.WorkoutId };
                var retryVersion = existing.Version + 1;
                var retryVersionedFilter = executionFilter
                    & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);
                var retryUpdate = Builders<SessionExecution>.Update
                    .Set(c => c.CompletedWorkoutIds, retryIds)
                    .Set(c => c.DateUpdated, DateTime.UtcNow)
                    .Set(c => c.Version, retryVersion);
                var retryResult = await mongo.SessionExecutions.UpdateOneAsync(retryVersionedFilter, retryUpdate, cancellationToken: ct);

                if (retryResult.ModifiedCount == 0)
                {
                    await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                        "Version conflict. The completion record was modified by another request.", ct);
                    return;
                }

                existing.CompletedWorkoutIds = retryIds;
                existing.Version = retryVersion;

                await TrainingProgressBroadcaster.BroadcastSessionAsync(
                    notifier, compliance, mongo, linkAuthorizationService, plan, clientId,
                    req.SessionId, DateOnly.FromDateTime(targetDate),
                    existing.CompletedExerciseInstanceIds.Count, totalExercises,
                    logger, ct,
                    workoutId: req.WorkoutId, workoutComplete: true);

                await Send.OkAsync(BuildResponse(req.SessionId, req.WorkoutId, targetDate, existing, totalExercises), ct);
                return;
            }

            await TrainingProgressBroadcaster.BroadcastSessionAsync(
                notifier, compliance, mongo, linkAuthorizationService, plan, clientId,
                req.SessionId, DateOnly.FromDateTime(targetDate),
                execution.CompletedExerciseInstanceIds.Count, totalExercises,
                logger, ct,
                workoutId: req.WorkoutId, workoutComplete: true);

            await Send.OkAsync(BuildResponse(req.SessionId, req.WorkoutId, targetDate, execution, totalExercises), ct);
        }
    }

    private static MarkWorkoutCompleteResponse BuildResponse(
        Guid sessionId, Guid workoutId, DateTime date, SessionExecution execution, int totalExercises)
    {
        return new MarkWorkoutCompleteResponse
        {
            SessionId = sessionId,
            WorkoutId = workoutId,
            Date = DateOnly.FromDateTime(date),
            CompletedExerciseCount = execution.CompletedExerciseInstanceIds.Count,
            TotalExerciseCount = totalExercises,
            Version = execution.Version
        };
    }
}
