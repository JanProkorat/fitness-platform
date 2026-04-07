using FitnessPlatform.Application.Features.Recipes.Shared;

namespace FitnessPlatform.Application.Features.Recipes.CreateRecipe;

/// <summary>
/// Request model for creating a new recipe.
/// </summary>
public class CreateRecipeRequest
{
    /// <summary>
    /// Name of the recipe.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description or preparation instructions.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Estimated preparation/cooking time in minutes.
    /// </summary>
    public int? PrepTimeMinutes { get; set; }

    /// <summary>
    /// Ordered preparation steps.
    /// </summary>
    public List<string>? Steps { get; set; }

    /// <summary>Optional tip or note.</summary>
    public string? Note { get; set; }

    /// <summary>
    /// List of food items to include in the recipe.
    /// </summary>
    public List<RecipeFoodDto> Foods { get; set; } = [];
}
