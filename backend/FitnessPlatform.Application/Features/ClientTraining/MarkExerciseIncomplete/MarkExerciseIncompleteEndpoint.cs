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

        // Validate the exercise exists in the session
        var exerciseExists = session.Exercises.Any(e => e.ExerciseExternalId == req.ExerciseExternalId);
        if (!exerciseExists)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingExerciseNotFound, "The exercise was not found in the specified session.", ct);
            return;
        }

        // Load the completion document for (clientId, date, sessionId)
        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        if (existing is null || !existing.CompletedExerciseIds.Contains(req.ExerciseExternalId))
        {
            // Idempotent: already not complete
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

        var newIds = existing.CompletedExerciseIds.Where(id => id != req.ExerciseExternalId).ToList();
        var newVersion = existing.Version + 1;

        var versionedFilter = completionFilter
                              & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

        var update = Builders<TrainingCompletion>.Update
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
