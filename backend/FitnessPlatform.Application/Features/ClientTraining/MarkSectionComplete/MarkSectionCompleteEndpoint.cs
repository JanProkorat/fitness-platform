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

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSectionComplete;

/// <summary>
/// Marks a single section within a session as complete for the client on the specified date.
/// Intended for sections that have no exercises (e.g. a ForTime "Running" section) where
/// exercise-level tracking is not applicable.
/// Idempotent: re-completing an already-complete section returns success without side effects.
/// Uses optimistic concurrency on the <see cref="TrainingCompletion"/> document.
/// Slides the Live lock TTL forward (keep-alive) when a Live lock exists for this session.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="lockService">Session lock service — used to refresh the Live TTL on activity.</param>
/// <param name="lockOptions">Training lock TTL configuration.</param>
/// <param name="logger">Logger.</param>
public class MarkSectionCompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    ISessionLockService lockService,
    IOptions<TrainingLockOptions> lockOptions,
    ILogger<MarkSectionCompleteEndpoint> logger)
    : Endpoint<MarkSectionCompleteRequest, MarkSectionCompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/sessions/{SessionId}/sections/{SectionId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark a section complete";
            s.Description = "Marks a section within a training session as complete for the specified date. " +
                            "Used for exercise-free sections (ForTime, etc.). Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkSectionCompleteRequest req, CancellationToken ct)
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

        var clientId = clientProfile.PublicId;
        var targetDate = (req.CompletedOn ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Resolve the client's Active training plan whose date window contains today (and
        // validate session/section ownership) — a client may hold several sequential,
        // non-overlapping Active plans (#780).
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                         & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, DateTime.UtcNow);

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
        await lockService.RefreshAsync(req.SessionId, LockType.Live,
            TimeSpan.FromHours(lockOptions.Value.LiveTtlHours), ct);

        session.WithBackfilledSections();
        var section = session.Sections.FirstOrDefault(s => s.SectionId == req.SectionId);
        if (section is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingSectionNotFound, "The section was not found in the specified session.", ct);
            return;
        }

        var totalExercises = session.Exercises.Count;

        // Load or create the completion document for (clientId, date, sessionId)
        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            // Idempotency: already complete — return success immediately
            if ((existing.CompletedSectionIds ?? []).Contains(req.SectionId))
            {
                await Send.OkAsync(BuildResponse(req.SessionId, req.SectionId, targetDate, existing, totalExercises), ct);
                return;
            }

            // Optimistic concurrency check when updating an existing document
            if (req.Version.HasValue && existing.Version != req.Version.Value)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            var newSectionIds = new List<Guid>(existing.CompletedSectionIds ?? []) { req.SectionId };
            var newVersion = existing.Version + 1;

            var versionedFilter = completionFilter
                                  & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

            var update = Builders<TrainingCompletion>.Update
                .Set(c => c.CompletedSectionIds, newSectionIds)
                .Set(c => c.DateUpdated, DateTime.UtcNow)
                .Set(c => c.Version, newVersion);

            var updateResult = await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

            if (updateResult.ModifiedCount == 0)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            existing.CompletedSectionIds = newSectionIds;
            existing.Version = newVersion;

            await TrainingProgressBroadcaster.BroadcastSessionAsync(
                notifier, compliance, mongo, plan, clientId,
                req.SessionId, DateOnly.FromDateTime(targetDate),
                existing.CompletedExerciseIds.Count, totalExercises,
                logger, ct,
                sectionId: req.SectionId, sectionComplete: true);

            await Send.OkAsync(BuildResponse(req.SessionId, req.SectionId, targetDate, existing, totalExercises), ct);
        }
        else
        {
            // Create a new completion document
            var completion = new TrainingCompletion
            {
                ExternalId = Guid.NewGuid(),
                ClientId = clientId,
                Date = targetDate,
                SessionId = req.SessionId,
                CompletedExerciseIds = [],
                CompletedSectionIds = [req.SectionId],
                DateCreated = DateTime.UtcNow,
                Version = 1
            };

            try
            {
                await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);
            }
            catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError?.Code == 11000)
            {
                // Duplicate-key: a concurrent request inserted the document first.
                // Re-read and retry the update path once.
                using var retryCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
                existing = await retryCursor.FirstOrDefaultAsync(ct);

                if (existing is null)
                {
                    // Genuinely unexpected — let the global exception handler return 500.
                    throw;
                }

                if ((existing.CompletedSectionIds ?? []).Contains(req.SectionId))
                {
                    await Send.OkAsync(BuildResponse(req.SessionId, req.SectionId, targetDate, existing, totalExercises), ct);
                    return;
                }

                var retryIds = new List<Guid>(existing.CompletedSectionIds ?? []) { req.SectionId };
                var retryVersion = existing.Version + 1;
                var retryVersionedFilter = completionFilter
                    & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);
                var retryUpdate = Builders<TrainingCompletion>.Update
                    .Set(c => c.CompletedSectionIds, retryIds)
                    .Set(c => c.DateUpdated, DateTime.UtcNow)
                    .Set(c => c.Version, retryVersion);
                var retryResult = await mongo.TrainingCompletions.UpdateOneAsync(retryVersionedFilter, retryUpdate, cancellationToken: ct);

                if (retryResult.ModifiedCount == 0)
                {
                    await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                        "Version conflict. The completion record was modified by another request.", ct);
                    return;
                }

                existing.CompletedSectionIds = retryIds;
                existing.Version = retryVersion;

                await TrainingProgressBroadcaster.BroadcastSessionAsync(
                    notifier, compliance, mongo, plan, clientId,
                    req.SessionId, DateOnly.FromDateTime(targetDate),
                    existing.CompletedExerciseIds.Count, totalExercises,
                    logger, ct,
                    sectionId: req.SectionId, sectionComplete: true);

                await Send.OkAsync(BuildResponse(req.SessionId, req.SectionId, targetDate, existing, totalExercises), ct);
                return;
            }

            await TrainingProgressBroadcaster.BroadcastSessionAsync(
                notifier, compliance, mongo, plan, clientId,
                req.SessionId, DateOnly.FromDateTime(targetDate),
                completion.CompletedExerciseIds.Count, totalExercises,
                logger, ct,
                sectionId: req.SectionId, sectionComplete: true);

            await Send.OkAsync(BuildResponse(req.SessionId, req.SectionId, targetDate, completion, totalExercises), ct);
        }
    }

    private static MarkSectionCompleteResponse BuildResponse(
        Guid sessionId, Guid sectionId, DateTime date, TrainingCompletion completion, int totalExercises)
    {
        return new MarkSectionCompleteResponse
        {
            SessionId = sessionId,
            SectionId = sectionId,
            Date = DateOnly.FromDateTime(date),
            CompletedExerciseCount = completion.CompletedExerciseIds.Count,
            TotalExerciseCount = totalExercises,
            Version = completion.Version
        };
    }
}
