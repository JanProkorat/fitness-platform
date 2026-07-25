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

namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;

/// <summary>
/// Marks a single exercise within a session as complete for the client on the specified date.
/// Idempotent: re-completing an already-complete exercise returns success without side effects.
/// Uses optimistic concurrency on the <see cref="SessionExecution"/> document.
/// Slides the Live lock TTL forward (keep-alive) when a Live lock exists for this session.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="lockService">Session lock service — used to refresh the Live TTL on activity.</param>
/// <param name="lockOptions">Training lock TTL configuration.</param>
/// <param name="logger">Logger.</param>
public class MarkExerciseCompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    ISessionLockService lockService,
    IOptions<TrainingLockOptions> lockOptions,
    ILogger<MarkExerciseCompleteEndpoint> logger)
    : Endpoint<MarkExerciseCompleteRequest, MarkExerciseCompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/sessions/{SessionId}/exercises/{ExerciseExternalId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark an exercise complete";
            s.Description = "Marks a single exercise within a training session as complete for the specified date. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkExerciseCompleteRequest req, CancellationToken ct)
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

        // Resolve the client's Active training plan whose date window contains today (and
        // validate session/exercise ownership) — a client may hold several sequential,
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
            .SelectMany(w => w.Sessions)
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
        // Fire-and-forget style: lock refresh failure must not block the completion.
        await lockService.RefreshAsync(req.SessionId, LockType.Live,
            TimeSpan.FromHours(lockOptions.Value.LiveTtlHours), ct);

        // Validate section exists within the session.
        var section = session.Sections.FirstOrDefault(s => s.SectionId == req.SectionId);
        if (section is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingSectionNotFound, "The section was not found in the specified session.", ct);
            return;
        }

        // Validate the exercise exists within that specific section.
        var exerciseExists = section.Exercises.Any(e => e.ExerciseExternalId == req.ExerciseExternalId);
        if (!exerciseExists)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingExerciseNotFound, "The exercise was not found in the specified section.", ct);
            return;
        }

        // Load or create the execution document for (clientId, date, sessionId)
        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<SessionExecution>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<SessionExecution>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
        var existing = await executionCursor.FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            // Idempotency: already complete in this section — return success immediately.
            var sectionList = existing.CompletedExerciseIdsBySection?.GetValueOrDefault(req.SectionId.ToString());
            if (sectionList is not null && sectionList.Contains(req.ExerciseExternalId))
            {
                await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, session.Exercises.Count), ct);
                return;
            }

            // Optimistic concurrency check when updating an existing document
            if (req.Version.HasValue && existing.Version != req.Version.Value)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            // ── Section-aware dict ────────────────────────────────────────────
            existing.CompletedExerciseIdsBySection ??= new Dictionary<string, List<Guid>>();
            if (!existing.CompletedExerciseIdsBySection.TryGetValue(req.SectionId.ToString(), out var secList))
                existing.CompletedExerciseIdsBySection[req.SectionId.ToString()] = secList = [];
            if (!secList.Contains(req.ExerciseExternalId))
                secList.Add(req.ExerciseExternalId);

            // ── Mirror into legacy flat list (idempotent add) ─────────────────
            var newIds = existing.CompletedExerciseIds.Contains(req.ExerciseExternalId)
                ? existing.CompletedExerciseIds
                : new List<Guid>(existing.CompletedExerciseIds) { req.ExerciseExternalId };

            var newVersion = existing.Version + 1;

            var versionedFilter = executionFilter
                                  & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);

            var update = Builders<SessionExecution>.Update
                .Set(c => c.CompletedExerciseIdsBySection, existing.CompletedExerciseIdsBySection)
                .Set(c => c.CompletedExerciseIds, newIds)
                .Set(c => c.DateUpdated, DateTime.UtcNow)
                .Set(c => c.Version, newVersion);

            var updateResult = await mongo.SessionExecutions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

            if (updateResult.ModifiedCount == 0)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            existing.CompletedExerciseIds = newIds;
            existing.Version = newVersion;

            await TrainingProgressBroadcaster.BroadcastSessionAsync(
                notifier, compliance, mongo, plan, clientId,
                req.SessionId, DateOnly.FromDateTime(targetDate),
                newIds.Count, session.Exercises.Count,
                logger, ct);

            await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, session.Exercises.Count), ct);
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
                CompletedExerciseIds = [req.ExerciseExternalId],
                CompletedExerciseIdsBySection = new Dictionary<string, List<Guid>>
                {
                    [req.SectionId.ToString()] = [req.ExerciseExternalId]
                },
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

                var retrySectionList = existing.CompletedExerciseIdsBySection?.GetValueOrDefault(req.SectionId.ToString());
                if (retrySectionList is not null && retrySectionList.Contains(req.ExerciseExternalId))
                {
                    await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, session.Exercises.Count), ct);
                    return;
                }

                existing.CompletedExerciseIdsBySection ??= new Dictionary<string, List<Guid>>();
                if (!existing.CompletedExerciseIdsBySection.TryGetValue(req.SectionId.ToString(), out var retrySecList))
                    existing.CompletedExerciseIdsBySection[req.SectionId.ToString()] = retrySecList = [];
                if (!retrySecList.Contains(req.ExerciseExternalId))
                    retrySecList.Add(req.ExerciseExternalId);

                var retryIds = existing.CompletedExerciseIds.Contains(req.ExerciseExternalId)
                    ? existing.CompletedExerciseIds
                    : new List<Guid>(existing.CompletedExerciseIds) { req.ExerciseExternalId };

                var retryVersion = existing.Version + 1;
                var retryVersionedFilter = executionFilter
                    & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);
                var retryUpdate = Builders<SessionExecution>.Update
                    .Set(c => c.CompletedExerciseIdsBySection, existing.CompletedExerciseIdsBySection)
                    .Set(c => c.CompletedExerciseIds, retryIds)
                    .Set(c => c.DateUpdated, DateTime.UtcNow)
                    .Set(c => c.Version, retryVersion);
                var retryResult = await mongo.SessionExecutions.UpdateOneAsync(retryVersionedFilter, retryUpdate, cancellationToken: ct);

                if (retryResult.ModifiedCount == 0)
                {
                    await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                        "Version conflict. The completion record was modified by another request.", ct);
                    return;
                }

                existing.CompletedExerciseIds = retryIds;
                existing.Version = retryVersion;
                await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, session.Exercises.Count), ct);
                return;
            }

            await TrainingProgressBroadcaster.BroadcastSessionAsync(
                notifier, compliance, mongo, plan, clientId,
                req.SessionId, DateOnly.FromDateTime(targetDate),
                execution.CompletedExerciseIds.Count, session.Exercises.Count,
                logger, ct);

            await Send.OkAsync(BuildResponse(req.SessionId, targetDate, execution, session.Exercises.Count), ct);
        }
    }

    private static MarkExerciseCompleteResponse BuildResponse(
        Guid sessionId, DateTime date, SessionExecution execution, int totalExercises)
    {
        var completed = execution.CompletedExerciseIds.Count;
        return new MarkExerciseCompleteResponse
        {
            SessionId = sessionId,
            Date = DateOnly.FromDateTime(date),
            CompletedExerciseCount = completed,
            TotalExerciseCount = totalExercises,
            SessionComplete = completed >= totalExercises,
            Version = execution.Version
        };
    }
}
