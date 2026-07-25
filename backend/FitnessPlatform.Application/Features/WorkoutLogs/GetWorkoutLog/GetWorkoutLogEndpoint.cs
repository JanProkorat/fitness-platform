using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.GetWorkoutLog;

/// <summary>
/// Retrieves a single workout log with full detail.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetWorkoutLogEndpoint(IMongoContext mongo) : Endpoint<GetWorkoutLogRequest, WorkoutLogDetail>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/training/logs/{LogId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get workout log detail";
            s.Description = "Returns a single workout log with all exercises and sets.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetWorkoutLogRequest req, CancellationToken ct)
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
                     & Builders<SessionExecution>.Filter.Exists(w => w.Performance);

        using var cursor = await mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
        var log = await cursor.FirstOrDefaultAsync(ct);

        if (log is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(WorkoutLogDetail.FromDocument(log), ct);
    }
}
