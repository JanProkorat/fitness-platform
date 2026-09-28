using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.Shared;

/// <summary>
/// The own-or-public visibility filter shared by every Foods read endpoint that lists more than
/// one document. Extracted so <see cref="Foods.SearchFoods.SearchFoodsEndpoint"/> and
/// <see cref="Foods.GetFoodTags.GetFoodTagsEndpoint"/> cannot drift apart on this rule.
/// </summary>
public static class FoodVisibilityFilter
{
    /// <summary>
    /// Builds the "not deleted AND (Public OR owned by the caller)" filter. A
    /// <see cref="Guid.Empty"/> caller id suppresses the ownership term entirely — mirrors
    /// <c>LibrarySearchHelper.SearchAsync</c>'s Guid.Empty refusal (#992) — so a document that
    /// explicitly stores a zero-uuid owner can't be matched as "owned by the caller".
    /// </summary>
    /// <param name="currentUserId">The authenticated caller's user id.</param>
    public static FilterDefinition<Food> BuildOwnOrPublic(Guid currentUserId)
    {
        var filterBuilder = Builders<Food>.Filter;

        var visibilityFilter = currentUserId == Guid.Empty
            ? filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public)
            : filterBuilder.Or(
                filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public),
                filterBuilder.Eq(f => f.NutritionistId, currentUserId));

        return filterBuilder.Eq(f => f.IsDeleted, false) & visibilityFilter;
    }
}
