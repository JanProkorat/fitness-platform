using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Exercises.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Exercises.GetCustomExercises;

/// <summary>
/// Retrieves a paginated list of custom exercises created by the authenticated trainer.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetCustomExercisesEndpoint(IMongoContext mongo) : Endpoint<GetCustomExercisesRequest, GetCustomExercisesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/exercises/custom");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get custom exercises";
            s.Description = "Returns a paginated list of custom exercises created by the authenticated trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetCustomExercisesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);
        var filter = Builders<Exercise>.Filter.Eq(e => e.TrainerId, trainerId)
            & Builders<Exercise>.Filter.Eq(e => e.IsActive, true);

        var totalCount = await mongo.Exercises.CountDocumentsAsync(filter, cancellationToken: ct);

        var findOptions = new FindOptions<Exercise>
        {
            Sort = Builders<Exercise>.Sort.Descending(e => e.DateCreated),
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize
        };

        using var cursor = await mongo.Exercises.FindAsync(filter, findOptions, ct);
        var exercises = await cursor.ToListAsync(ct);

        await Send.OkAsync(new GetCustomExercisesResponse
        {
            Exercises = exercises.Select(e => ExerciseSummary.FromDocument(e)).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
