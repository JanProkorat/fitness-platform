using FitnessPlatform.Application.Features.Recipes.Shared;

namespace FitnessPlatform.Application.Features.Recipes.UpdateRecipe;

/// <summary>
/// Request model for updating an existing recipe.
/// </summary>
public class UpdateRecipeRequest
{
    /// <summary>
    /// Public identifier of the recipe to update.
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// Updated name of the recipe.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated description or preparation instructions.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Updated list of food items in the recipe.
    /// </summary>
    public List<RecipeFoodDto> Foods { get; set; } = [];
}
