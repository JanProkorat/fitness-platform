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

namespace FitnessPlatform.Application.Features.ClientTraining.MarkWorkoutIncomplete;

/// <summary>
/// Removes the completion mark for a single section within a session on the specified date.
/// Idempotent: if the section is already not marked complete, returns success without side effects.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier for pushing the <c>trainingprogressupdated</c> event.</param>
/// <param name="compliance">Compliance service for computing today's metrics.</param>
/// <param name="logger">Logger.</param>
public class MarkWorkoutIncompleteEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
    ILogger<MarkWorkoutIncompleteEndpoint> logger)
    : Endpoint<MarkWorkoutIncompleteRequest, MarkWorkoutIncompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/training/sessions/{SessionId}/sections/{SectionId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Un-mark a section as complete";
            s.Description = "Removes the completion mark for a section in a training session. Idempotent.";
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

        // Validate the section exists in the session
        var section = session.Workouts.FirstOrDefault(s => s.WorkoutId == req.SectionId);
        if (section is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingWorkoutNotFound, "The section was not found in the specified session.", ct);
            return;
        }

        var totalExercises = session.Exercises.Count;

        // Load the execution document for (clientId, date, sessionId)
        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<SessionExecution>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<SessionExecution>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
        var existing = await executionCursor.FirstOrDefaultAsync(ct);

        if (existing is null || !(existing.CompletedSectionIds ?? []).Contains(req.SectionId))
        {
            // Idempotent: already not complete
            var completedCount = existing?.CompletedExerciseIds.Count ?? 0;
            await Send.OkAsync(new MarkWorkoutIncompleteResponse
            {
                SessionId = req.SessionId,
                SectionId = req.SectionId,
                Date = DateOnly.FromDateTime(targetDate),
                CompletedExerciseCount = completedCount,
                TotalExerciseCount = totalExercises,
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

        var newSectionIds = existing.CompletedSectionIds!.Where(id => id != req.SectionId).ToList();
        var newVersion = existing.Version + 1;

        var versionedFilter = executionFilter
                              & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);

        var update = Builders<SessionExecution>.Update
            .Set(c => c.CompletedSectionIds, newSectionIds)
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
            existing.CompletedExerciseIds.Count, totalExercises,
            logger, ct);

        await Send.OkAsync(new MarkWorkoutIncompleteResponse
        {
            SessionId = req.SessionId,
            SectionId = req.SectionId,
            Date = DateOnly.FromDateTime(targetDate),
            CompletedExerciseCount = existing.CompletedExerciseIds.Count,
            TotalExerciseCount = totalExercises,
            Version = newVersion
        }, ct);
    }
}
