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

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;
        var targetDate = (req.CompletedOn ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Validate the session belongs to the client's Active plan whose date window contains
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
            .SelectMany(w => w.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingSessionNotFound, "The session was not found in the active training plan.", ct);
            return;
        }

        // Validate the exercise exists in the session (section-aware).
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

        // Load the execution document for (clientId, date, sessionId)
        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<SessionExecution>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<SessionExecution>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
        var existing = await executionCursor.FirstOrDefaultAsync(ct);

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

        // ── #841: if this execution also carries Performance (live-training-assistant data),
        // clear the matching set's CompletedAt stamp IN THE SAME DOCUMENT — no more best-effort
        // cross-collection sync into a separate WorkoutLog.
        if (existing.Performance is not null)
        {
            var exerciseEntry = existing.Performance.Exercises
                .FirstOrDefault(e => e.ExerciseExternalId == req.ExerciseExternalId);

            if (exerciseEntry is not null)
            {
                foreach (var set in exerciseEntry.Sets)
                    set.CompletedAt = null;
            }
        }

        var newVersion = existing.Version + 1;

        var versionedFilter = executionFilter
                              & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);

        var update = Builders<SessionExecution>.Update
            .Set(c => c.CompletedExerciseIdsBySection, existing.CompletedExerciseIdsBySection)
            .Set(c => c.CompletedExerciseIds, newIds)
            .Set(c => c.Performance, existing.Performance)
            .Set(c => c.DateUpdated, DateTime.UtcNow)
            .Set(c => c.Version, newVersion);

        var updateResult = await mongo.SessionExecutions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

        if (updateResult.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                "Version conflict. The completion record was modified by another request.", ct);
            return;
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
