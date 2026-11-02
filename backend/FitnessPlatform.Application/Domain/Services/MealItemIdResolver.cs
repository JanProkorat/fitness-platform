using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Assigns the stable <see cref="MealFood.ItemId"/> / <see cref="MealRecipe.ItemId"/> of a meal
/// that is being rewritten from a full-state request, so an item keeps its identity (and the
/// client's eaten tick) across edits. Foods and recipes are separate matching pools.
/// Per item, in order: (1) the id the caller sent, when it belongs to the stored meal with the same
/// MealId and no earlier item of the request already took it; (2) the next unclaimed stored item
/// referencing the same food/recipe, in stored order; (3) a new id.
/// </summary>
internal static class MealItemIdResolver
{
    /// <summary>
    /// Resolves the ids of a meal's foods.
    /// </summary>
    /// <param name="stored">The stored meal with the same MealId, or null for a new meal.</param>
    /// <param name="incoming">The request's foods in order: the sent id and the food's external id.</param>
    public static List<Guid> ResolveFoodIds(PlanMeal? stored, IReadOnlyList<(Guid? SentItemId, Guid FoodExternalId)> incoming) =>
        Resolve(
            stored?.Foods.Select(food => (food.ItemId, Reference: food.FoodExternalId)).ToList() ?? [],
            incoming.Select(item => (item.SentItemId, Reference: item.FoodExternalId)).ToList());

    /// <summary>
    /// Resolves the ids of a meal's recipes.
    /// </summary>
    /// <param name="stored">The stored meal with the same MealId, or null for a new meal.</param>
    /// <param name="incoming">The request's recipes in order: the sent id and the recipe id.</param>
    public static List<Guid> ResolveRecipeIds(PlanMeal? stored, IReadOnlyList<(Guid? SentItemId, Guid RecipeId)> incoming) =>
        Resolve(
            stored?.Recipes.Select(recipe => (recipe.ItemId, Reference: recipe.RecipeId)).ToList() ?? [],
            incoming.Select(item => (item.SentItemId, Reference: item.RecipeId)).ToList());

    private static List<Guid> Resolve(
        List<(Guid ItemId, Guid Reference)> stored,
        List<(Guid? SentItemId, Guid Reference)> incoming)
    {
        var resolved = new Guid[incoming.Count];
        var assigned = new bool[incoming.Count];
        var claimed = new HashSet<Guid>();
        var storedIds = stored.Select(item => item.ItemId).ToHashSet();

        for (var i = 0; i < incoming.Count; i++)
        {
            if (incoming[i].SentItemId is { } sent
                && sent != Guid.Empty
                && storedIds.Contains(sent)
                && claimed.Add(sent))
            {
                resolved[i] = sent;
                assigned[i] = true;
            }
        }

        for (var i = 0; i < incoming.Count; i++)
        {
            if (assigned[i])
            {
                continue;
            }

            var match = stored.FindIndex(item =>
                item.Reference == incoming[i].Reference
                && item.ItemId != Guid.Empty
                && !claimed.Contains(item.ItemId));

            resolved[i] = match >= 0 ? stored[match].ItemId : Guid.NewGuid();
            claimed.Add(resolved[i]);
        }

        return resolved.ToList();
    }
}
