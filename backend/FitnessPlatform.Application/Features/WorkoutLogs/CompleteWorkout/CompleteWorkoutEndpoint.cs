using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;

/// <summary>
/// Completes a workout session: runs PR detection, creates notifications, and marks the
/// <see cref="SessionExecution"/> Completed (Performance + checkbox completion flags in a single
/// write — #841 retired the separate TrainingCompletion fan-out).
/// Also releases the <c>Live</c> session lock when the log is plan-bound
/// (i.e. when the log carries a non-null <c>SessionId</c>).
/// Emits <c>sessioneditlockchanged</c> (state=Stable) to both client and trainer when a lock is released.
/// Emits <c>trainingprogressupdated</c> to the trainer so the portal reflects the finished state in real time.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="completionService">Shared workout completion pipeline (PR detection, fan-out, notification).</param>
/// <param name="lockService">Session lock service — used to release the Live lock on finish.</param>
/// <param name="notifier">Realtime notifier for SignalR fan-out.</param>
/// <param name="compliance">Compliance service for computing today's metrics (used by the broadcaster).</param>
/// <param name="logger">Logger for swallowing broadcast errors.</param>
public class CompleteWorkoutEndpoint(
    IMongoContext mongo,
    IWorkoutCompletionService completionService,
    ISessionLockService lockService,
    IRealtimeNotifier notifier,
    IComplianceService compliance,
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
            s.Description = "Marks the workout as completed, runs PR detection, creates trainer notifications, " +
                            "and releases the Live session lock (for plan-bound workouts).";
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

        var filter = Builders<SessionExecution>.Filter.Eq(w => w.ExternalId, req.LogId)
                     & Builders<SessionExecution>.Filter.Eq(w => w.ClientId, clientId)
                     & Builders<SessionExecution>.Filter.Exists(w => w.Performance)
                     & Builders<SessionExecution>.Filter.Eq(w => w.Status, SessionExecutionStatus.Partial);

        using var cursor = await mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
        var log = await cursor.FirstOrDefaultAsync(ct);

        if (log is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Delegate the full completion pipeline (PR detection, log update,
        // TrainingCompletion fan-out, notification) to the shared service.
        // Live client completions use DateTime.UtcNow as the completion instant.
        try
        {
            await completionService.CompleteAsync(log, DateTime.UtcNow, ct);
        }
        catch (WorkoutAlreadyCompletedException)
        {
            // TOCTOU: two concurrent completions of the same session on the same day.
            // The partial unique index {planId, sessionId, completedDate | isCompleted==true}
            // rejected this duplicate; surface as 409 so the loser gets a clear error.
            await this.SendProblemAsync(409, ErrorCodes.SessionAlreadyCompleted,
                "This session was already completed today by a concurrent request.", ct);
            return;
        }

        // ── Release the Live lock (plan-bound workouts only) ──────────────────────
        // Ad-hoc workouts have no session, so no lock was acquired — skip silently.
        // ReleaseAsync is idempotent: returns false when the lock is already gone
        // (expired or already released), which is not an error.
        // Only emit sessioneditlockchanged when ReleaseAsync returns true — emitting Stable
        // for a session that had no lock would be spurious fan-out.
        if (log.SessionId.HasValue)
        {
            var released = await lockService.ReleaseAsync(log.SessionId.Value, LockHolder.Client, LockType.Live, ct);

            if (log.PlanId.HasValue)
            {
                // Load the plan once — used for both the lock-changed broadcast and the progress broadcast.
                var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, log.PlanId.Value);
                using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
                var plan = await planCursor.FirstOrDefaultAsync(ct);

                if (plan is not null)
                {
                    if (released)
                    {
                        // Emit sessioneditlockchanged (state=Stable) to both parties.
                        var lockPayload = new SessionLockChangedPayload(
                            log.PlanId.Value,
                            log.SessionId.Value,
                            "Stable",
                            "Client");

                        await notifier.NotifyAsync(clientId, "sessioneditlockchanged", lockPayload, ct);
                        await notifier.NotifyAsync(plan.TrainerId, "sessioneditlockchanged", lockPayload, ct);
                    }

                    // Emit trainingprogressupdated so the trainer portal reflects the finished state in real time.
                    // plan.ClientId is the ApplicationUser.Id (#840) — the same key used by compliance / TrainingCompletion.
                    // All exercises in the log were stamped as done by completionService; count both sides as totalExercises.
                    var totalExercises = log.Exercises.Count;
                    await TrainingProgressBroadcaster.BroadcastSessionAsync(
                        notifier, compliance, mongo, plan,
                        clientId: plan.ClientId,
                        sessionId: log.SessionId.Value,
                        date: DateOnly.FromDateTime(log.Date),
                        completedExerciseCount: totalExercises,
                        totalExerciseCount: totalExercises,
                        logger, ct);
                }
            }
        }

        await Send.OkAsync(WorkoutLogDetail.FromDocument(log), ct);
    }
}
