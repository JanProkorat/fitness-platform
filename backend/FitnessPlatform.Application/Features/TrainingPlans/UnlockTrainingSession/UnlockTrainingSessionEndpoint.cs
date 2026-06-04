using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.UnlockTrainingSession;

/// <summary>
/// Acquires an Editing lock on a published training session, allowing the trainer to edit it.
/// Returns 409 if the session is currently in Live state (client is training).
/// The ownership guard ensures only the plan's owning trainer may unlock.
/// Emits <c>sessioneditlockchanged</c> (state=Editing) to both client and trainer on successful acquire.
/// </summary>
public class UnlockTrainingSessionEndpoint(
    IMongoContext mongo,
    ISessionLockService lockService,
    IOptions<TrainingLockOptions> lockOptions,
    IRealtimeNotifier notifier)
    : Endpoint<UnlockTrainingSessionRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plans/{PlanId}/sessions/{SessionId}/unlock");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Unlock a training session for editing";
            s.Description = "Acquires an Editing lock on the session. " +
                            "Returns 409 if the session is currently Live (client is training).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UnlockTrainingSessionRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Ownership guard first: plan must exist AND belong to the calling trainer.
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);

        var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify the session exists in the plan (any week).
        var session = plan.Weeks
            .SelectMany(w => w.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Finished-guard: reject unlock attempts on sessions that are already finished.
        // Two completion signals must be checked — live path (WorkoutLog.IsCompleted=true) and
        // home-checkbox path (TrainingCompletion fully complete per IsSessionComplete()).
        // Checked AFTER ownership/existence guards (404 takes precedence) and BEFORE acquiring the Editing lock.
        // Reuses the existing SESSION_ALREADY_COMPLETED error code (matches FinishSessionEndpoint pattern).

        // Signal 1: completed WorkoutLog
        var completedLogFilter = Builders<WorkoutLog>.Filter.Eq(l => l.PlanId, req.PlanId)
                                 & Builders<WorkoutLog>.Filter.Eq(l => l.SessionId, req.SessionId)
                                 & Builders<WorkoutLog>.Filter.Eq(l => l.IsCompleted, true);
        var completedLogCount = await mongo.WorkoutLogs.CountDocumentsAsync(completedLogFilter, cancellationToken: ct);

        if (completedLogCount > 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.SessionAlreadyCompleted,
                "This session has already been completed and cannot be unlocked for editing.", ct);
            return;
        }

        // Signal 2: fully-complete TrainingCompletion (written by mobile home-checkbox path).
        // Match any completion for this session regardless of date — finished state is permanent.
        // Call WithBackfilledSections() first so legacy flat-exercise sessions are handled correctly.
        session.WithBackfilledSections();
        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, plan.ClientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, req.SessionId);
        var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var completionDocs = await completionCursor.ToListAsync(ct);

        if (completionDocs.Any(c => c.IsSessionComplete(session)))
        {
            await this.SendProblemAsync(409, ErrorCodes.SessionAlreadyCompleted,
                "This session has already been completed and cannot be unlocked for editing.", ct);
            return;
        }

        var ttl = TimeSpan.FromHours(lockOptions.Value.EditingTtlHours);

        var result = await lockService.AcquireAsync(
            sessionId: req.SessionId,
            planId: plan.ExternalId,
            clientId: plan.ClientId,
            trainerId: trainerId,
            holder: LockHolder.Coach,
            type: LockType.Editing,
            ttl: ttl,
            ct: ct);

        switch (result)
        {
            case AcquireResult.Acquired:
                // Emit sessioneditlockchanged (state=Editing) to both parties on successful acquire.
                var payload = new SessionLockChangedPayload(
                    plan.ExternalId,
                    req.SessionId,
                    "Editing",
                    "Coach");

                await notifier.NotifyAsync(plan.ClientId, "sessioneditlockchanged", payload, ct);
                await notifier.NotifyAsync(trainerId, "sessioneditlockchanged", payload, ct);

                await Send.NoContentAsync(ct);
                break;

            case AcquireResult.LockConflict:
                // 409 conflict path — emit nothing; no state transition occurred.
                // The session is currently locked — either Live (client training) or
                // already in Editing by someone else. Both cases are 409 session_locked.
                await this.SendProblemAsync(
                    409,
                    ErrorCodes.SessionLocked,
                    $"Session {req.SessionId} is currently locked and cannot be unlocked for editing.",
                    ct);
                break;
        }
    }
}
