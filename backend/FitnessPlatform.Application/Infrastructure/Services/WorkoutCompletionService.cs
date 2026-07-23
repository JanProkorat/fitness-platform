using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Default implementation of <see cref="IWorkoutCompletionService"/>.
///
/// Extracted from <c>CompleteWorkoutEndpoint</c> so that the trainer-driven
/// <c>FinishSessionEndpoint</c> can reuse the same completion pipeline (PR
/// detection, TrainingCompletion fan-out, notification) without duplicating
/// business logic.
/// </summary>
public class WorkoutCompletionService(
    IMongoContext mongo,
    IApplicationDbContext db,
    IPrDetectionService prDetection,
    INotificationService notifications,
    ILogger<WorkoutCompletionService> logger) : IWorkoutCompletionService
{
    /// <inheritdoc />
    public async Task<List<string>> CompleteAsync(
        WorkoutLog log,
        DateTime completedAtUtc,
        CancellationToken ct)
    {
        // 1. PR detection — mutates log.Exercises[].Sets[].IsPR in place.
        var prDescriptions = await prDetection.DetectAndMarkPRsAsync(log, ct);

        // 2. Mark the log as completed at the supplied instant.
        //    CompletedDate is set to midnight UTC on the same calendar day as completedAtUtc,
        //    using WorkoutLog.ToCompletionDateUtc so that both CompletedDate and the
        //    TrainingCompletion.Date key always agree on the calendar day for backdated finishes.
        log.CompletedAt = completedAtUtc;
        log.CompletedDate = WorkoutLog.ToCompletionDateUtc(completedAtUtc);
        log.IsCompleted = true;
        log.DateUpdated = DateTime.UtcNow;

        try
        {
            await mongo.WorkoutLogs.ReplaceOneAsync(
                w => w.ExternalId == log.ExternalId,
                log,
                cancellationToken: ct);
        }
        catch (MongoWriteException ex)
            when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new WorkoutAlreadyCompletedException(ex);
        }
        catch (MongoCommandException ex)
            when (ex.Code == 11000 /* E11000 */ || ex.CodeName == "DuplicateKey")
        {
            throw new WorkoutAlreadyCompletedException(ex);
        }

        // 3. Fan out a TrainingCompletion doc so compliance/streak picks up this workout.
        // Best-effort: a failure must NOT affect the primary contract (log.IsCompleted=true).
        try
        {
            await UpsertTrainingCompletionAsync(log, completedAtUtc, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "TrainingCompletion fan-out failed for workout log {LogId}. Workout completion succeeded.",
                log.ExternalId);
        }

        // 4. Notify trainer when PRs were detected (throttled: max 1 per workout).
        if (prDescriptions.Count > 0 && log.PlanId.HasValue)
        {
            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, log.PlanId.Value);
            using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var plan = await planCursor.FirstOrDefaultAsync(ct);

            if (plan is not null)
            {
                var prSummary = string.Join(", ", prDescriptions.Take(3));

                await notifications.CreateAsync(
                    plan.TrainerId,
                    NotificationType.PersonalRecord,
                    new Dictionary<string, string>
                    {
                        ["summary"] = prSummary,
                        ["workoutLogId"] = log.ExternalId.ToString(),
                        ["clientId"] = log.ClientId.ToString(),
                    },
                    ct: ct);
            }
        }

        return prDescriptions;
    }

    // ── Best-effort TrainingCompletion fan-out ────────────────────────────────────
    // Mirrors the upsert pattern in MarkSessionCompleteEndpoint so that
    // ComplianceService.IsSessionCompleteForDateAsync sees this workout.
    //
    // The completedAtUtc parameter drives the date key, ensuring that a backdated
    // finish is attributed to the correct calendar day — not DateTime.UtcNow.
    private async Task UpsertTrainingCompletionAsync(
        WorkoutLog log,
        DateTime completedAtUtc,
        CancellationToken ct)
    {
        // Only planned-session workouts are tracked for compliance.
        if (!log.SessionId.HasValue || !log.PlanId.HasValue)
            return;

        var sessionId = log.SessionId.Value;

        // Resolve the plan's session to get all exercise ids.
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, log.PlanId.Value);
        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            logger.LogWarning(
                "TrainingCompletion fan-out: plan {PlanId} not found for workout log {LogId}.",
                log.PlanId.Value, log.ExternalId);
            return;
        }

        var session = plan.Weeks
            .SelectMany(w => w.Sessions)
            .FirstOrDefault(s => s.SessionId == sessionId);

        if (session is null)
        {
            logger.LogWarning(
                "TrainingCompletion fan-out: session {SessionId} not found in plan {PlanId} for workout log {LogId}.",
                sessionId, log.PlanId.Value, log.ExternalId);
            return;
        }

        var allExerciseIds = session.Exercises.Select(e => e.ExerciseExternalId).ToList();
        var allSectionIds = session.Sections.Select(s => s.SectionId).ToList();
        var completedBySection = session.Sections.ToDictionary(
            s => s.SectionId.ToString(),
            s => s.Exercises.Select(e => e.ExerciseExternalId).ToList());

        // Resolve clientId as PublicId — TrainingCompletion keyed by ClientProfile.PublicId,
        // not the raw UserId stored on WorkoutLog.ClientId.
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == log.ClientId, ct);

        if (clientProfile is null)
        {
            logger.LogWarning(
                "TrainingCompletion fan-out: ClientProfile not found for UserId {UserId}.",
                log.ClientId);
            return;
        }

        var clientId = clientProfile.PublicId;

        // Date key: the calendar day of the supplied completion instant (NOT DateTime.UtcNow).
        // Uses WorkoutLog.ToCompletionDateUtc — the same helper used for WorkoutLog.CompletedDate —
        // so that both values always agree on the calendar day for backdated finishes.
        var date = WorkoutLog.ToCompletionDateUtc(completedAtUtc);

        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, date)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, sessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            // Idempotency: skip the write only when every per-session field already matches.
            // Consults the section-aware CompletedExerciseIdsBySection map only — the retired
            // flat CompletedExerciseIds field is kept as a derived mirror (see TrainingCompletion.cs)
            // and is no longer an authoritative signal for this check.
            var sectionDictAligned =
                existing.CompletedExerciseIdsBySection is not null
                && completedBySection.All(kvp =>
                    existing.CompletedExerciseIdsBySection!.TryGetValue(kvp.Key, out var ids)
                    && kvp.Value.All(id => ids.Contains(id)));
            var sectionIdsAligned = allSectionIds.All(id =>
                (existing.CompletedSectionIds ?? new List<Guid>()).Contains(id));
            if (sectionDictAligned && sectionIdsAligned)
                return;

            var versionedFilter = completionFilter
                                  & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

            var update = Builders<TrainingCompletion>.Update
                .Set(c => c.CompletedExerciseIds, allExerciseIds)
                .Set(c => c.CompletedExerciseIdsBySection, completedBySection)
                .Set(c => c.CompletedSectionIds, allSectionIds)
                .Set(c => c.DateUpdated, DateTime.UtcNow)
                .Set(c => c.Version, existing.Version + 1);

            await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);
        }
        else
        {
            var completion = new TrainingCompletion
            {
                ExternalId = Guid.NewGuid(),
                ClientId = clientId,
                Date = date,
                SessionId = sessionId,
                CompletedExerciseIds = allExerciseIds,
                CompletedExerciseIdsBySection = completedBySection,
                CompletedSectionIds = allSectionIds,
                DateCreated = DateTime.UtcNow,
                Version = 1
            };

            await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);
        }
    }
}
