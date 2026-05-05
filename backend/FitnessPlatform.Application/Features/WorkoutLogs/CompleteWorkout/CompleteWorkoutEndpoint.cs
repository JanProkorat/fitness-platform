using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;

/// <summary>
/// Completes a workout session: runs PR detection, creates notifications, marks as done,
/// and fans out a <see cref="TrainingCompletion"/> document so that compliance and streak
/// calculations pick up the live workout alongside plan-driven completions.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context (used to resolve ClientProfile.PublicId).</param>
/// <param name="prDetection">Personal record detection service.</param>
/// <param name="notifications">Notification creation service.</param>
/// <param name="logger">Logger for best-effort fan-out warnings.</param>
public class CompleteWorkoutEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IPrDetectionService prDetection,
    INotificationService notifications,
    ILogger<CompleteWorkoutEndpoint> logger) : Endpoint<CompleteWorkoutRequest, WorkoutLogDetail>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/logs/{LogId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Complete a workout";
            s.Description = "Marks the workout as completed, runs PR detection, and creates trainer notifications.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CompleteWorkoutRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);

        var filter = Builders<WorkoutLog>.Filter.Eq(w => w.ExternalId, req.LogId)
                     & Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, clientId)
                     & Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, false);

        using var cursor = await mongo.WorkoutLogs.FindAsync(filter, cancellationToken: ct);
        var log = await cursor.FirstOrDefaultAsync(ct);

        if (log is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Run PR detection
        var prDescriptions = await prDetection.DetectAndMarkPRsAsync(log, ct);

        // Mark as completed
        log.CompletedAt = DateTime.UtcNow;
        log.IsCompleted = true;
        log.DateUpdated = DateTime.UtcNow;

        await mongo.WorkoutLogs.ReplaceOneAsync(
            w => w.ExternalId == req.LogId,
            log,
            cancellationToken: ct);

        // Fan out a TrainingCompletion doc so compliance/streak picks up this live workout.
        // Best-effort: a failure here must NOT affect the primary contract (log.IsCompleted=true).
        try
        {
            await UpsertTrainingCompletionAsync(log, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "TrainingCompletion fan-out failed for workout log {LogId}. Workout completion succeeded.",
                req.LogId);
        }

        // Create trainer notification if any PRs detected (throttled: max 1 per workout)
        if (prDescriptions.Count > 0)
        {
            // Find the trainer via the training plan
            if (log.PlanId.HasValue)
            {
                var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, log.PlanId.Value);
                using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
                var plan = await planCursor.FirstOrDefaultAsync(ct);

                if (plan is not null)
                {
                    var prSummary = string.Join(", ", prDescriptions.Take(3));
                    var data = JsonSerializer.Serialize(new { workoutLogId = log.ExternalId, clientId });

                    await notifications.CreateAsync(
                        plan.TrainerId,
                        NotificationType.PersonalRecord,
                        "New Personal Record!",
                        prSummary,
                        data,
                        ct);
                }
            }
        }

        await Send.OkAsync(WorkoutLogDetail.FromDocument(log), ct);
    }

    // ── Best-effort TrainingCompletion fan-out ────────────────────────────────────
    // Mirrors the upsert pattern in MarkSessionCompleteEndpoint so that
    // ComplianceService.IsSessionCompleteForDateAsync sees this live workout.

    private async Task UpsertTrainingCompletionAsync(WorkoutLog log, CancellationToken ct)
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

        session.WithBackfilledSections();
        var allExerciseIds = session.Exercises.Select(e => e.ExerciseExternalId).ToList();

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

        // Date key: the calendar day the workout was *finalised* (UTC).
        // Using completion time (DateTime.UtcNow) aligns with MarkSessionCompleteEndpoint,
        // MarkSessionIncompleteEndpoint, and MarkExerciseIncompleteEndpoint so that
        // GetTodaySessionEndpoint — which reads by DateTime.UtcNow.Date — always finds the doc.
        var date = DateOnly.FromDateTime(DateTime.UtcNow).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, date)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, sessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            // Idempotency: if the doc already contains every exercise id, no write needed.
            if (allExerciseIds.All(id => existing.CompletedExerciseIds.Contains(id)))
                return;

            var versionedFilter = completionFilter
                                  & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

            var update = Builders<TrainingCompletion>.Update
                .Set(c => c.CompletedExerciseIds, allExerciseIds)
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
                DateCreated = DateTime.UtcNow,
                Version = 1
            };

            await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);
        }
    }
}
