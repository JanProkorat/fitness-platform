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

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionIncomplete;

/// <summary>
/// Clears all completion records for an entire training session on the specified date.
/// Idempotent: if the session has no completion document, returns success.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="logger">Logger.</param>
public class MarkSessionIncompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    ILogger<MarkSessionIncompleteEndpoint> logger)
    : Endpoint<MarkSessionIncompleteRequest, MarkSessionIncompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/training/sessions/{SessionId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Un-mark a training session as complete";
            s.Description = "Removes all exercise completion marks for a training session on the specified date. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkSessionIncompleteRequest req, CancellationToken ct)
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

        // Validate session ownership via the Active plan whose date window contains today — a
        // client may hold several sequential, non-overlapping Active plans (#780).
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

        session.WithBackfilledSections();

        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        if (existing is null)
        {
            // Idempotent: no completion document exists
            await Send.OkAsync(new MarkSessionIncompleteResponse
            {
                SessionId = req.SessionId,
                Date = DateOnly.FromDateTime(targetDate),
                CompletedExerciseCount = 0,
                TotalExerciseCount = session.Exercises.Count,
                Version = 1
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

        var newVersion = existing.Version + 1;
        var versionedFilter = completionFilter
                              & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

        var update = Builders<TrainingCompletion>.Update
            .Set(c => c.CompletedExerciseIds, new List<Guid>())
            .Set(c => c.CompletedExerciseIdsBySection, new Dictionary<string, List<Guid>>())
            .Set(c => c.CompletedSectionIds, new List<Guid>())
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
                foreach (var exercise in log.Exercises)
                    foreach (var set in exercise.Sets)
                        set.CompletedAt = null;

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
                "Failed to clear WorkoutLog CompletedAt stamps for session {SessionId} on {Date}. " +
                "TrainingCompletion was already cleared; this is best-effort.",
                req.SessionId, targetDate);
        }

        await TrainingProgressBroadcaster.BroadcastSessionAsync(
            notifier, compliance, mongo, plan, clientId,
            req.SessionId, DateOnly.FromDateTime(targetDate),
            0, session.Exercises.Count,
            logger, ct);

        await Send.OkAsync(new MarkSessionIncompleteResponse
        {
            SessionId = req.SessionId,
            Date = DateOnly.FromDateTime(targetDate),
            CompletedExerciseCount = 0,
            TotalExerciseCount = session.Exercises.Count,
            Version = newVersion
        }, ct);
    }
}
