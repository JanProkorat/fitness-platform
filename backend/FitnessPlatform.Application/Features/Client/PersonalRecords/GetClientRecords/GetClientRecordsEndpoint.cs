using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Client.PersonalRecords.GetClientRecords;

/// <summary>
/// Lists the authenticated client's personal records with optional exercise filter and pagination.
/// Total matching count is returned in the X-Total-Count response header.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetClientRecordsEndpoint(IMongoContext mongo)
    : Endpoint<GetClientRecordsRequest, GetClientRecordsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/records");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "List personal records";
            s.Description = "Returns a paginated list of the authenticated client's personal records, " +
                            "sorted by AchievedAt descending. Optionally filtered by exercise. " +
                            "Total count is in the X-Total-Count response header.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientRecordsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // ClientId in PersonalRecord = user.Id (Guid), identical to WorkoutLog.ClientId —
        // the JWT AppClaims.UserId claim is set to ApplicationUser.Id in LoginEndpoint.
        var clientId = Guid.Parse(userId);

        // Build filter: always scope to the authenticated client, optionally filter by exercise
        var filter = Builders<PersonalRecord>.Filter.Eq(r => r.ClientId, clientId);

        if (req.ExerciseExternalId.HasValue)
        {
            filter &= Builders<PersonalRecord>.Filter.Eq(
                r => r.ExerciseExternalId, req.ExerciseExternalId.Value);
        }

        // Count total matching documents for the X-Total-Count header
        var totalCount = await mongo.PersonalRecords.CountDocumentsAsync(filter, cancellationToken: ct);

        // Sort: AchievedAt DESC primary, _id ASC stable tiebreaker
        var sort = Builders<PersonalRecord>.Sort
            .Descending(r => r.AchievedAt)
            .Ascending(r => r.Id);

        var options = new FindOptions<PersonalRecord>
        {
            Sort = sort,
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize
        };

        using var cursor = await mongo.PersonalRecords.FindAsync(filter, options, ct);
        var records = await cursor.ToListAsync(ct);

        HttpContext.Response.Headers["X-Total-Count"] = totalCount.ToString();

        await Send.OkAsync(new GetClientRecordsResponse
        {
            Items = records.Select(r => new PersonalRecordSummary
            {
                ExternalId = r.ExternalId,
                ExerciseExternalId = r.ExerciseExternalId,
                ExerciseName = r.ExerciseName,
                WeightKg = r.WeightKg,
                Reps = r.Reps,
                AchievedAt = r.AchievedAt,
                WorkoutLogId = r.WorkoutLogId
            }).ToList()
        }, ct);
    }
}
