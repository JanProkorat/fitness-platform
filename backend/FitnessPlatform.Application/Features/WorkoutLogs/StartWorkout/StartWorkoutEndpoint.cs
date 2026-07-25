using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;

/// <summary>
/// Starts a new workout session for the authenticated client.
/// Creates a draft workout log and returns its ID for progressive logging.
/// Does NOT acquire a Live lock — the client must call POST .../go-live after pressing Start
/// to transition the session to Live state.
/// Ad-hoc workouts (null PlanId or null SessionId) skip plan/ownership validation entirely.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class StartWorkoutEndpoint(
    IMongoContext mongo) : Endpoint<StartWorkoutRequest, StartWorkoutResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/logs");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Start a workout (create draft log)";
            s.Description = "Creates a new empty workout log and returns its ID for progressive logging. " +
                            "Does NOT acquire a Live lock — call POST .../go-live when the client presses Start.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(StartWorkoutRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // clientUserIdGuid is the ApplicationUser.Id (what JWT AppClaims.UserId stores).
        // WorkoutLog.ClientId is set to this value.
        var clientUserIdGuid = Guid.Parse(userId);
        var now = DateTime.UtcNow;

        // ── Ownership validation (plan-bound workouts only) ───────────────────────
        // Ad-hoc workouts (null PlanId or null SessionId) skip plan lookup entirely —
        // there is no session to gate and no trainer who could be editing.
        if (req.PlanId.HasValue && req.SessionId.HasValue)
        {
            // Load the plan to validate ownership.
            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId.Value);
            using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var plan = await planCursor.FirstOrDefaultAsync(ct);

            if (plan is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            // Ownership check: TrainingPlan.ClientId holds the ApplicationUser.Id since #840 —
            // compare directly against the caller's JWT-derived UserId (no ClientProfile lookup
            // required for this check).
            if (plan.ClientId != clientUserIdGuid)
            {
                await Send.ForbiddenAsync(ct);
                return;
            }
        }

        var log = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserIdGuid,
            PlanId = req.PlanId,
            SessionId = req.SessionId,
            StartedAt = now,
            IsCompleted = false,
            Sections = [],
            DateCreated = now
        };

        await mongo.WorkoutLogs.InsertOneAsync(log, cancellationToken: ct);

        await HttpContext.Response.SendAsync(new StartWorkoutResponse
        {
            LogId = log.ExternalId,
            StartedAt = now
        }, 201, cancellation: ct);
    }
}
