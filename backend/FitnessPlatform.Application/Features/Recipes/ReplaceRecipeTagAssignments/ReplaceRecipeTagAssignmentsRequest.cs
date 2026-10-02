namespace FitnessPlatform.Application.Features.Recipes.ReplaceRecipeTagAssignments;

/// <summary>
/// Request body for replacing the full set of tags assigned to a recipe. <c>RecipeId</c> is bound
/// from the route.
/// </summary>
public class ReplaceRecipeTagAssignmentsRequest
{
    /// <summary>
    /// Public identifier of the recipe, from the route.
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// Public identifiers of the tags to assign. An empty list clears every assignment the
    /// caller holds for this recipe.
    /// </summary>
    public List<Guid> TagIds { get; set; } = [];
}
