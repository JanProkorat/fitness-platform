using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.Shared;

/// <summary>
/// The own-or-public visibility filter shared by every recipe read.
/// </summary>
public static class RecipeVisibilityFilter
{
    /// <summary>
    /// Matches the caller's own recipes (any visibility) or any Public recipe. The ownership term
    /// is suppressed for an empty caller id, so a document that stores a zero-uuid owner can't be
    /// matched as "owned by the caller".
    /// </summary>
    public static FilterDefinition<Recipe> BuildOwnOrPublic(Guid callerId)
    {
        var filterBuilder = Builders<Recipe>.Filter;

        return callerId == Guid.Empty
            ? filterBuilder.Eq(r => r.Visibility, RecipeVisibility.Public)
            : filterBuilder.Or(
                filterBuilder.Eq(r => r.NutritionistId, callerId),
                filterBuilder.Eq(r => r.Visibility, RecipeVisibility.Public));
    }
}
