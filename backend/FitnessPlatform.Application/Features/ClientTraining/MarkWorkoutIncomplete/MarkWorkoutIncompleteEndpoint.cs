using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkWorkoutIncomplete;

/// <summary>
/// Removes the completion mark for a single workout within a session on the specified date.
/// Idempotent: if the workout is already not marked complete, returns success without side effects.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="linkAuthorizationService">Link capability service for the trainer-progress broadcast.</param>
/// <param name="logger">Logger.</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class MarkWorkoutIncompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    IClientLinkAuthorizationService linkAuthorizationService,
    ILogger<MarkWorkoutIncompleteEndpoint> logger,
    TimeProvider timeProvider)
    : Endpoint<MarkWorkoutIncompleteRequest, MarkWorkoutIncompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/training/sessions/{SessionId}/workouts/{WorkoutId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Un-mark a workout as complete";
            s.Description = "Removes the completion mark for a workout in a training session. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkWorkoutIncompleteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // req.CompletedOn is never populated by the client in practice — the fallback resolves
        // the CLIENT's local calendar day (#935) rather than the server's UTC day. Resolves the
        // client's Active training plan whose date window contains that date (a client may hold
        // several sequential, non-overlapping Active plans, #780) — the shared cross-store
        // assembly (#938) also validates the ClientProfile exists.
        var loadResult = await this.LoadActiveTrainingPlanForClientAsync(
            db, mongo, Guid.Parse(userId),
            req.CompletedOn?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            timeProvider.GetUtcNow().UtcDateTime, ct);

        if (loadResult is null)
        {
            return;
        }

        var (clientId, targetDate, plan) = loadResult.Value;

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

        // Validate the workout exists in the session
        var workout = session.Workouts.FirstOrDefault(w => w.WorkoutId == req.WorkoutId);
        if (workout is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingWorkoutNotFound, "The workout was not found in the specified session.", ct);
            return;
        }

        // Load the execution document for (clientId, date, sessionId)
        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<SessionExecution>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<SessionExecution>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
        var existing = await executionCursor.FirstOrDefaultAsync(ct);

        if (existing is null || !(existing.CompletedWorkoutIds ?? []).Contains(req.WorkoutId))
        {
            // Idempotent: already not complete. Canonical placement-exact rule (#938/#849)
            // replaces the hand-computed CompletedExerciseInstanceIds.Count.
            var completedCount = existing?.ResolveCompletedInstanceIds(session).Count ?? 0;
            await Send.OkAsync(new MarkWorkoutIncompleteResponse
            {
                SessionId = req.SessionId,
                WorkoutId = req.WorkoutId,
                Date = DateOnly.FromDateTime(targetDate),
                CompletedExerciseCount = completedCount,
                TotalExerciseCount = session.AllExercises.Count,
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

        var newWorkoutIds = existing.CompletedWorkoutIds!.Where(id => id != req.WorkoutId).ToList();
        var newVersion = existing.Version + 1;

        var versionedFilter = executionFilter
                              & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);

        var update = Builders<SessionExecution>.Update
            .Set(c => c.CompletedWorkoutIds, newWorkoutIds)
            .Set(c => c.DateUpdated, DateTime.UtcNow)
            .Set(c => c.Version, newVersion);

        var updateResult = await mongo.SessionExecutions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

        if (updateResult.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                "Version conflict. The completion record was modified by another request.", ct);
            return;
        }

        existing.CompletedWorkoutIds = newWorkoutIds;
        var completedExerciseCount = existing.ResolveCompletedInstanceIds(session).Count;

        await TrainingProgressBroadcaster.BroadcastSessionAsync(
            notifier, compliance, mongo, linkAuthorizationService, plan, clientId,
            req.SessionId, DateOnly.FromDateTime(targetDate),
            completedExerciseCount, session.AllExercises.Count,
            logger, ct);

        await Send.OkAsync(new MarkWorkoutIncompleteResponse
        {
            SessionId = req.SessionId,
            WorkoutId = req.WorkoutId,
            Date = DateOnly.FromDateTime(targetDate),
            CompletedExerciseCount = completedExerciseCount,
            TotalExerciseCount = session.AllExercises.Count,
            Version = newVersion
        }, ct);
    }
}
