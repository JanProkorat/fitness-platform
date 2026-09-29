using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.GetFoodTags;

/// <summary>
/// Returns the distinct set of tags across every food visible to the caller.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetFoodTagsEndpoint(IMongoContext mongo) : EndpointWithoutRequest<GetFoodTagsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/foods/tags");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List food tags";
            s.Description = "Returns the distinct tags across every food visible to the caller — "
                + "public foods plus the caller's own private foods. Powers the tags filter pill "
                + "and the drawer's tag suggestions.";
            s.Response<GetFoodTagsResponse>(StatusCodes.Status200OK, "Distinct tags");
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(AppClaims.UserId);

        if (!Guid.TryParse(userIdClaim, out var currentUserId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Same own-or-public visibility filter as SearchFoodsEndpoint (shared, so the two can't
        // drift) — a tags listing must not leak a tag that exists only on another coach's
        // Private food.
        var filter = FoodVisibilityFilter.BuildOwnOrPublic(currentUserId);

        // Mongo's distinct command unwinds array fields server-side, so this returns individual
        // tag strings without pulling every matching food's full document (nutrients included)
        // across the wire just to read one field.
        using var cursor = await mongo.Foods.DistinctAsync<string>("tags", filter, cancellationToken: ct);
        var rawTags = await cursor.ToListAsync(ct);

        var tags = rawTags
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(t => t, StringComparer.OrdinalIgnoreCase)
            .ToList();

        await Send.OkAsync(new GetFoodTagsResponse { Tags = tags }, ct);
    }
}
