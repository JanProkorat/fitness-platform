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

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionComplete;

/// <summary>
/// Marks an entire training session as complete by marking all exercises in the session complete.
/// Fans out to a single execution document for (clientId, date, sessionId).
/// Idempotent: re-completing an already-complete session returns success.
/// Slides the Live lock TTL forward (keep-alive) when a Live lock exists for this session.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="lockService">Session lock service — used to refresh the Live TTL on activity.</param>
/// <param name="lockOptions">Training lock TTL configuration.</param>
/// <param name="logger">Logger.</param>
public class MarkSessionCompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    ISessionLockService lockService,
    IOptions<TrainingLockOptions> lockOptions,
    ILogger<MarkSessionCompleteEndpoint> logger)
    : Endpoint<MarkSessionCompleteRequest, MarkSessionCompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/sessions/{SessionId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark a training session complete";
            s.Description = "Marks all exercises in a training session as complete for the specified date. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkSessionCompleteRequest req, CancellationToken ct)
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
        var targetDate = (req.CompletedOn ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Validate session ownership via the Active training plan whose date window contains
        // today — a client may hold several sequential, non-overlapping Active plans (#780).
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

        var allExerciseIds = session.Exercises.Select(e => e.ExerciseExternalId).ToList();
        var allSectionIds = session.Workouts.Select(w => w.WorkoutId).ToList();
        // Per-workout attribution map: each workout explicitly carries the
        // exercise ids that belong to IT. Required because the read-time
        // backfill in `SessionExecutionBackfill` falls back to "first
        // workout that contains this id" — when the same exercise id is
        // referenced from multiple workouts (e.g. two AMRAPs sharing
        // "Bench"), the duplicate would get attributed to only the first
        // workout and the second one would read as not-done after refresh.
        var completedBySection = session.Workouts.ToDictionary(
            w => w.WorkoutId.ToString(),
            w => w.Exercises.Select(e => e.ExerciseExternalId).ToList());

        // Load or create the execution document
        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<SessionExecution>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<SessionExecution>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
        var existing = await executionCursor.FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            // Idempotency: the session is already complete when every section is "done".
            // Uses the shared SessionExecutionExtensions.IsSessionComplete helper (rule-of-three:
            // also called from GetTrainingPlan and UnlockTrainingSession).
            var alreadyComplete = existing.IsSessionComplete(session);
            if (alreadyComplete)
            {
                await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, allExerciseIds.Count), ct);
                return;
            }

            // Optimistic concurrency check
            if (req.Version.HasValue && existing.Version != req.Version.Value)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            var newVersion = existing.Version + 1;
            var versionedFilter = executionFilter
                                  & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);

            var update = Builders<SessionExecution>.Update
                .Set(c => c.CompletedExerciseIds, allExerciseIds)
                .Set(c => c.CompletedExerciseIdsBySection, completedBySection)
                .Set(c => c.CompletedWorkoutIds, allSectionIds)
                .Set(c => c.DateUpdated, DateTime.UtcNow)
                .Set(c => c.Version, newVersion);

            var updateResult = await mongo.SessionExecutions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

            if (updateResult.ModifiedCount == 0)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            existing.CompletedExerciseIds = allExerciseIds;
            existing.CompletedWorkoutIds = allSectionIds;
            existing.Version = newVersion;

            await TrainingProgressBroadcaster.BroadcastSessionAsync(
                notifier, compliance, mongo, plan, clientId,
                req.SessionId, DateOnly.FromDateTime(targetDate),
                allExerciseIds.Count, allExerciseIds.Count,
                logger, ct);

            await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, allExerciseIds.Count), ct);
        }
        else
        {
            var execution = new SessionExecution
            {
                ExternalId = Guid.NewGuid(),
                ClientId = clientId,
                PlanId = plan.ExternalId,
                Date = targetDate,
                SessionId = req.SessionId,
                CompletedExerciseIds = allExerciseIds,
                CompletedExerciseIdsBySection = completedBySection,
                CompletedWorkoutIds = allSectionIds,
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

                // Retry path — same completeness check via shared helper.
                var retryAlreadyComplete = existing.IsSessionComplete(session);
                if (retryAlreadyComplete)
                {
                    await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, allExerciseIds.Count), ct);
                    return;
                }

                var retryVersion = existing.Version + 1;
                var retryVersionedFilter = executionFilter
                    & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);
                var retryUpdate = Builders<SessionExecution>.Update
                    .Set(c => c.CompletedExerciseIds, allExerciseIds)
                    .Set(c => c.CompletedExerciseIdsBySection, completedBySection)
                    .Set(c => c.CompletedWorkoutIds, allSectionIds)
                    .Set(c => c.DateUpdated, DateTime.UtcNow)
                    .Set(c => c.Version, retryVersion);
                var retryResult = await mongo.SessionExecutions.UpdateOneAsync(retryVersionedFilter, retryUpdate, cancellationToken: ct);

                if (retryResult.ModifiedCount == 0)
                {
                    await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                        "Version conflict. The completion record was modified by another request.", ct);
                    return;
                }

                existing.CompletedExerciseIds = allExerciseIds;
                existing.CompletedWorkoutIds = allSectionIds;
                existing.Version = retryVersion;
                await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, allExerciseIds.Count), ct);
                return;
            }

            await TrainingProgressBroadcaster.BroadcastSessionAsync(
                notifier, compliance, mongo, plan, clientId,
                req.SessionId, DateOnly.FromDateTime(targetDate),
                allExerciseIds.Count, allExerciseIds.Count,
                logger, ct);

            await Send.OkAsync(BuildResponse(req.SessionId, targetDate, execution, allExerciseIds.Count), ct);
        }
    }

    private static MarkSessionCompleteResponse BuildResponse(
        Guid sessionId, DateTime date, SessionExecution execution, int totalExercises)
    {
        return new MarkSessionCompleteResponse
        {
            SessionId = sessionId,
            Date = DateOnly.FromDateTime(date),
            CompletedExerciseCount = execution.CompletedExerciseIds.Count,
            TotalExerciseCount = totalExercises,
            Version = execution.Version
        };
    }
}
