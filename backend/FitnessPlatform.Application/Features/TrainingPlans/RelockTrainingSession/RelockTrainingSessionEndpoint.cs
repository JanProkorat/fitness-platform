using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.RelockTrainingSession;

/// <summary>
/// Releases the Editing lock on a training session, returning it to Stable state.
/// Idempotent: if the lock is already gone (released, expired) this is a no-op success.
/// Ownership guard: only the plan's owning trainer may relock.
/// </summary>
public class RelockTrainingSessionEndpoint(
    IMongoContext mongo,
    ISessionLockService lockService)
    : Endpoint<RelockTrainingSessionRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plans/{PlanId}/sessions/{SessionId}/relock");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Relock a training session (release the Editing lock)";
            s.Description = "Releases the Editing lock, returning the session to Stable state. " +
                            "Idempotent: if the lock is already released or expired this is a no-op success.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RelockTrainingSessionRequest req, CancellationToken ct)
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
        var sessionExists = plan.Weeks
            .SelectMany(w => w.Sessions)
            .Any(s => s.SessionId == req.SessionId);

        if (!sessionExists)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Release idempotently: ReleaseAsync returns false when no doc matched
        // (already released/expired), but that is still a success per the spec.
        await lockService.ReleaseAsync(
            sessionId: req.SessionId,
            holder: LockHolder.Coach,
            type: LockType.Editing,
            ct: ct);

        await Send.NoContentAsync(ct);
    }
}
