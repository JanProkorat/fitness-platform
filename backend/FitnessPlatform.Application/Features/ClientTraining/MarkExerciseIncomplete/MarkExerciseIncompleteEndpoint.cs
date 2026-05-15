using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseIncomplete;

/// <summary>
/// Removes the completion mark for a single exercise within a session on the specified date.
/// Idempotent: if the exercise is already not marked complete, returns success without side effects.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="logger">Logger.</param>
public class MarkExerciseIncompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    ILogger<MarkExerciseIncompleteEndpoint> logger)
    : Endpoint<MarkExerciseIncompleteRequest, MarkExerciseIncompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/training/sessions/{SessionId}/exercises/{ExerciseExternalId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Un-mark an exercise as complete";
            s.Description = "Removes the completion mark for a single exercise in a training session. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkExerciseIncompleteRequest req, CancellationToken ct)
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

        // Validate the session belongs to the client's active plan
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                         & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

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

        // Validate the exercise exists in the session (section-aware).
        session.WithBackfilledSections();

        var section = session.Sections.FirstOrDefault(s => s.SectionId == req.SectionId);
        if (section is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingSectionNotFound, "The section was not found in the specified session.", ct);
            return;
        }

        var exerciseExists = section.Exercises.Any(e => e.ExerciseExternalId == req.ExerciseExternalId);
        if (!exerciseExists)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingExerciseNotFound, "The exercise was not found in the specified section.", ct);
            return;
        }

        // Load the completion document for (clientId, date, sessionId)
        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        // Auto-backfill: legacy completion docs (written before per-section
        // tracking was added) carry the flat `CompletedExerciseIds` but
        // leave `CompletedExerciseIdsBySection` null. The idempotency check
        // + removal logic below only consult the per-section dict, so
        // without this step the legacy doc would short-circuit at "nothing
        // to remove" and the flat list would never clear — the exercise
        // would reappear as complete after every refresh via the read-time
        // backfill in `TrainingCompletionBackfill`. Populating the dict
        // up-front gives the removal logic something to delete from.
        if (existing is not null
            && (existing.CompletedExerciseIdsBySection is null
                || existing.CompletedExerciseIdsBySection.Count == 0)
            && existing.CompletedExerciseIds.Count > 0)
        {
            var effective = TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(existing, session);
            existing.CompletedExerciseIdsBySection = effective.ToDictionary(
                kvp => kvp.Key.ToString(),
                kvp => kvp.Value.ToList());
        }

        // Idempotency: check whether this exercise is complete in this specific section.
        var sectionList = existing?.CompletedExerciseIdsBySection?.GetValueOrDefault(req.SectionId.ToString());
        var isCompleteInSection = sectionList is not null && sectionList.Contains(req.ExerciseExternalId);

        if (existing is null || !isCompleteInSection)
        {
            // Not complete in this section — nothing to remove
            var completedCount = existing?.CompletedExerciseIds.Count ?? 0;
            await Send.OkAsync(new MarkExerciseIncompleteResponse
            {
                SessionId = req.SessionId,
                Date = DateOnly.FromDateTime(targetDate),
                CompletedExerciseCount = completedCount,
                TotalExerciseCount = session.Exercises.Count,
                SessionComplete = completedCount >= session.Exercises.Count,
                Version = existing?.Version ?? 1
            }, ct);
            return;
        }

        // Optimistic concurrency check
        if (req.Version.HasValue && existing.Version != req.Version.Value)
        {
            await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                "Version conflict. The completion record was modified by another request.", ct);
            return;
        }

        // ── Remove from the section-aware dict (only this section) ───────
        existing.CompletedExerciseIdsBySection ??= new Dictionary<string, List<Guid>>();
        if (existing.CompletedExerciseIdsBySection.TryGetValue(req.SectionId.ToString(), out var currentSectionList))
        {
            currentSectionList.Remove(req.ExerciseExternalId);
            if (currentSectionList.Count == 0)
                existing.CompletedExerciseIdsBySection.Remove(req.SectionId.ToString());
        }

        // ── Mirror: only remove from the legacy flat list if NO other section still has this exId ──
        var stillPresentInAnotherSection = existing.CompletedExerciseIdsBySection
            .Any(kvp => kvp.Value.Contains(req.ExerciseExternalId));

        var newIds = stillPresentInAnotherSection
            ? existing.CompletedExerciseIds
            : existing.CompletedExerciseIds.Where(id => id != req.ExerciseExternalId).ToList();

        var newVersion = existing.Version + 1;

        var versionedFilter = completionFilter
                              & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

        var update = Builders<TrainingCompletion>.Update
            .Set(c => c.CompletedExerciseIdsBySection, existing.CompletedExerciseIdsBySection)
            .Set(c => c.CompletedExerciseIds, newIds)
            .Set(c => c.DateUpdated, DateTime.UtcNow)
            .Set(c => c.Version, newVersion);

        var updateResult = await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

        if (updateResult.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                "Version conflict. The completion record was modified by another request.", ct);
            return;
        }

        // Mirror the un-mark into today's WorkoutLog(s) so the read side
        // (GetTodaySessionEndpoint) no longer re-merges stale CompletedAt stamps.
        // NOTE: WorkoutLog.ClientId is stored as the auth user's Id, NOT clientProfile.PublicId.
        var userIdGuid = Guid.Parse(userId);
        try
        {
            var tomorrow = targetDate.AddDays(1);
            var logFilter =
                Builders<WorkoutLog>.Filter.Eq(l => l.ClientId, userIdGuid)
                & Builders<WorkoutLog>.Filter.Eq(l => l.SessionId, (Guid?)req.SessionId)
                & Builders<WorkoutLog>.Filter.Gte(l => l.StartedAt, targetDate)
                & Builders<WorkoutLog>.Filter.Lt(l => l.StartedAt, tomorrow);

            using var logCursor = await mongo.WorkoutLogs.FindAsync(logFilter, cancellationToken: ct);
            var matchingLogs = await logCursor.ToListAsync(ct);

            foreach (var log in matchingLogs)
            {
                log.WithBackfilledSections();
                var exerciseEntry = log.Exercises
                    .FirstOrDefault(e => e.ExerciseExternalId == req.ExerciseExternalId);

                if (exerciseEntry is null)
                    continue;

                // Clear only this exercise's set timestamps.
                foreach (var set in exerciseEntry.Sets)
                    set.CompletedAt = null;

                // If every set across every exercise now lacks CompletedAt, mark the log as not completed.
                var anySetStillCompleted = log.Exercises
                    .SelectMany(e => e.Sets)
                    .Any(s => s.CompletedAt is not null);
                if (!anySetStillCompleted)
                    log.IsCompleted = false;

                log.DateUpdated = DateTime.UtcNow;

                await mongo.WorkoutLogs.ReplaceOneAsync(
                    Builders<WorkoutLog>.Filter.Eq(l => l.Id, log.Id),
                    log,
                    cancellationToken: ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to clear WorkoutLog CompletedAt stamps for exercise {ExerciseExternalId} " +
                "in session {SessionId} on {Date}. TrainingCompletion was already updated; this is best-effort.",
                req.ExerciseExternalId, req.SessionId, targetDate);
        }

        await TrainingProgressBroadcaster.BroadcastSessionAsync(
            notifier, compliance, mongo, plan, clientId,
            req.SessionId, DateOnly.FromDateTime(targetDate),
            newIds.Count, session.Exercises.Count,
            logger, ct);

        await Send.OkAsync(new MarkExerciseIncompleteResponse
        {
            SessionId = req.SessionId,
            Date = DateOnly.FromDateTime(targetDate),
            CompletedExerciseCount = newIds.Count,
            TotalExerciseCount = session.Exercises.Count,
            SessionComplete = newIds.Count >= session.Exercises.Count,
            Version = newVersion
        }, ct);
    }
}
