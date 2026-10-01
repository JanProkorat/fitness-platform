using FitnessPlatform.Application.Domain.Enums;
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
    /// Optional description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Estimated preparation time in minutes.
    /// </summary>
    public int? PrepTimeMinutes { get; set; }

    /// <summary>
    /// Cooking time in minutes.
    /// </summary>
    public int? CookTimeMinutes { get; set; }

    /// <summary>
    /// Number of servings the recipe yields. Must be greater than zero.
    /// </summary>
    public int Servings { get; set; } = 1;

    /// <summary>
    /// Optional preparation difficulty.
    /// </summary>
    public RecipeDifficulty? Difficulty { get; set; }

    /// <summary>
    /// Meal types the recipe is suited for. At least one is required.
    /// </summary>
    public List<RecipeMealType> MealTypes { get; set; } = [];

    /// <summary>
    /// Dietary preferences the recipe satisfies.
    /// </summary>
    public List<DietaryPreference> DietaryPreferences { get; set; } = [];

    /// <summary>
    /// Ordered preparation steps (list order is step order). Blank steps are dropped; at most 50,
    /// each at most 2000 characters.
    /// </summary>
    public List<string>? Steps { get; set; }

    /// <summary>Optional tip or note.</summary>
    public string? Note { get; set; }

    /// <summary>
    /// List of food items to include in the recipe. At least one is required.
    /// </summary>
    public List<RecipeFoodDto> Foods { get; set; } = [];

    /// <summary>
    /// Visibility of the recipe. Defaults to <see cref="RecipeVisibility.Private"/> when omitted.
    /// </summary>
    public RecipeVisibility Visibility { get; set; } = RecipeVisibility.Private;
}
