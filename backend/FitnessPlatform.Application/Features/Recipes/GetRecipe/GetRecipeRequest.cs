namespace FitnessPlatform.Application.Features.Recipes.GetRecipe;

/// <summary>
/// Request model for retrieving a single recipe.
/// </summary>
public class GetRecipeRequest
{
    /// <summary>
    /// Public identifier of the recipe.
    /// </summary>
    public Guid RecipeId { get; set; }
}
