namespace FitnessPlatform.Application.Features.Recipes.DeleteRecipe;

/// <summary>
/// Request model for deleting a recipe.
/// </summary>
public class DeleteRecipeRequest
{
    /// <summary>
    /// Public identifier of the recipe to delete.
    /// </summary>
    public Guid RecipeId { get; set; }
}
