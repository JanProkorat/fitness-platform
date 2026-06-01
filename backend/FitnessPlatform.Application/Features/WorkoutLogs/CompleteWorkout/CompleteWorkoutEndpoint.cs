using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;

/// <summary>
/// Completes a workout session: runs PR detection, creates notifications, marks as done,
/// and fans out a <see cref="TrainingCompletion"/> document so that compliance and streak
/// calculations pick up the live workout alongside plan-driven completions.
/// Also releases the <c>Live</c> session lock when the log is plan-bound
/// (i.e. when the log carries a non-null <c>SessionId</c>).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="completionService">Shared workout completion pipeline (PR detection, fan-out, notification).</param>
/// <param name="lockService">Session lock service — used to release the Live lock on finish.</param>
public class CompleteWorkoutEndpoint(
    IMongoContext mongo,
    IWorkoutCompletionService completionService,
    ISessionLockService lockService) : Endpoint<CompleteWorkoutRequest, WorkoutLogDetail>
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
        if (log.SessionId.HasValue)
        {
            await lockService.ReleaseAsync(log.SessionId.Value, LockHolder.Client, LockType.Live, ct);
        }

        await Send.OkAsync(WorkoutLogDetail.FromDocument(log), ct);
    }
}
