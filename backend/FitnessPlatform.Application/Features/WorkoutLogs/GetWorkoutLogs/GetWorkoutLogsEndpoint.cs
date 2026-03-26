using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.GetWorkoutLogs;

/// <summary>
/// Lists workout logs for the authenticated client with pagination.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetWorkoutLogsEndpoint(IMongoContext mongo) : Endpoint<GetWorkoutLogsRequest, GetWorkoutLogsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/training/logs");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "List workout logs";
            s.Description = "Returns a paginated list of the client's workout history.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetWorkoutLogsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);
        var filter = Builders<WorkoutLog>.Filter.Eq(w => w.ClientId, clientId);

        var totalCount = await mongo.WorkoutLogs.CountDocumentsAsync(filter, cancellationToken: ct);

        var options = new FindOptions<WorkoutLog>
        {
            Sort = Builders<WorkoutLog>.Sort.Descending(w => w.StartedAt),
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize
        };

        using var cursor = await mongo.WorkoutLogs.FindAsync(filter, options, ct);
        var logs = await cursor.ToListAsync(ct);

        await Send.OkAsync(new GetWorkoutLogsResponse
        {
            Logs = logs.Select(WorkoutLogSummary.FromDocument).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
