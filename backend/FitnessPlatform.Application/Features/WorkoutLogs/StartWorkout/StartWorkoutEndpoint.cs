using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;

/// <summary>
/// Starts a new workout session for the authenticated client.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class StartWorkoutEndpoint(IMongoContext mongo) : Endpoint<StartWorkoutRequest, StartWorkoutResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/logs");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Start a workout";
            s.Description = "Creates a new empty workout log and returns its ID for progressive logging.";
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

        var now = DateTime.UtcNow;

        var log = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.Parse(userId),
            PlanId = req.PlanId,
            SessionId = req.SessionId,
            StartedAt = now,
            IsCompleted = false,
            Exercises = [],
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
