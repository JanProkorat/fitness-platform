using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.WorkoutTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.ListWorkoutTemplates;

/// <summary>
/// Lists the calling trainer's workout templates with pagination.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class ListWorkoutTemplatesEndpoint(IMongoContext mongo)
    : Endpoint<ListWorkoutTemplatesRequest, ListWorkoutTemplatesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/workout-templates");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "List workout templates";
            s.Description = "Returns the calling trainer's workout templates, paginated. Session templates (formerly piggybacked here) have their own paginated search endpoint under /training/session-templates.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ListWorkoutTemplatesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);
        var filter = Builders<WorkoutTemplate>.Filter.Eq(t => t.OwnerTrainerId, trainerId);

        var total = await mongo.WorkoutTemplates.CountDocumentsAsync(filter, cancellationToken: ct);

        HttpContext.Response.Headers["X-Total-Count"] = total.ToString();

        var skip = (req.Page - 1) * req.PageSize;
        using var cursor = await mongo.WorkoutTemplates.FindAsync(
            filter,
            new FindOptions<WorkoutTemplate>
            {
                Sort = Builders<WorkoutTemplate>.Sort.Ascending(t => t.CreatedAt),
                Skip = skip,
                Limit = req.PageSize
            },
            ct);

        var templates = await cursor.ToListAsync(ct);

        var response = new ListWorkoutTemplatesResponse
        {
            OwnTemplates = templates.Select(WorkoutTemplateResponse.FromDocument).ToList()
        };

        await Send.OkAsync(response, ct);
    }
}
