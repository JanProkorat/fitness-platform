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
/// Idempotent: if the session has no execution document, returns success.
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

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;
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
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingSessionNotFound, "The session was not found in the active training plan.", ct);
            return;
        }

        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<SessionExecution>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<SessionExecution>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var executionCursor = await mongo.SessionExecutions.FindAsync(executionFilter, cancellationToken: ct);
        var existing = await executionCursor.FirstOrDefaultAsync(ct);

        if (existing is null)
        {
            // Idempotent: no execution document exists
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
        var versionedFilter = executionFilter
                              & Builders<SessionExecution>.Filter.Eq(c => c.Version, existing.Version);

        // #841: if this execution also carries Performance (live-training-assistant data),
        // clear every set's CompletedAt stamp IN THE SAME DOCUMENT — no more best-effort
        // cross-collection sync into a separate WorkoutLog.
        if (existing.Performance is not null)
        {
            foreach (var exercise in existing.Performance.Exercises)
                foreach (var set in exercise.Sets)
                    set.CompletedAt = null;
        }

        var update = Builders<SessionExecution>.Update
            .Set(c => c.CompletedExerciseIds, new List<Guid>())
            .Set(c => c.CompletedExerciseIdsBySection, new Dictionary<string, List<Guid>>())
            .Set(c => c.CompletedWorkoutIds, new List<Guid>())
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
