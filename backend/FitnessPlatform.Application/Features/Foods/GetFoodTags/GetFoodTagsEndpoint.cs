using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
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

        var filterBuilder = Builders<Food>.Filter;

        // Same own-or-public visibility filter as SearchFoodsEndpoint — a tags listing must
        // not leak a tag that exists only on another coach's Private food.
        var visibilityFilter = currentUserId == Guid.Empty
            ? filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public)
            : filterBuilder.Or(
                filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public),
                filterBuilder.Eq(f => f.NutritionistId, currentUserId));

        var filter = filterBuilder.Eq(f => f.IsDeleted, false) & visibilityFilter;

        using var cursor = await mongo.Foods.FindAsync(filter, cancellationToken: ct);
        var foods = await cursor.ToListAsync(ct);

        var tags = foods
            .SelectMany(f => f.Tags)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(t => t, StringComparer.OrdinalIgnoreCase)
            .ToList();

        await Send.OkAsync(new GetFoodTagsResponse { Tags = tags }, ct);
    }
}
