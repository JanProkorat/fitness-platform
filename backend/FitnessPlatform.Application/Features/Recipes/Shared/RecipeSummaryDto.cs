using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.Recipes.Shared;

/// <summary>
/// Lightweight recipe summary for list views.
/// </summary>
public class RecipeSummaryDto
{
    /// <summary>
    /// Public identifier of the recipe.
    /// </summary>
    public Guid RecipeId { get; set; }

    /// <summary>
    /// Name of the recipe.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Number of food items in the recipe.
    /// </summary>
    public int FoodCount { get; set; }

    /// <summary>
    /// Computed total macronutrients.
    /// </summary>
    public NutrientTotals TotalNutrients { get; set; } = new();

    /// <summary>
    /// Estimated preparation/cooking time in minutes.
    /// </summary>
    public int? PrepTimeMinutes { get; set; }

    /// <summary>
    /// When the recipe was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// Distinct food categories from the recipe's ingredients.
    /// </summary>
    public List<string> FoodCategories { get; set; } = [];

    /// <summary>
    /// Maps a <see cref="Recipe"/> document to a <see cref="RecipeSummaryDto"/>.
    /// </summary>
    /// <param name="recipe">The source recipe document.</param>
    /// <returns>A summary DTO.</returns>
    public static RecipeSummaryDto FromDocument(Recipe recipe) => new()
    {
        RecipeId = recipe.ExternalId,
        Name = recipe.Name,
        FoodCount = recipe.Foods.Count,
        TotalNutrients = recipe.TotalNutrients,
        PrepTimeMinutes = recipe.PrepTimeMinutes,
        DateCreated = recipe.DateCreated,
        FoodCategories = recipe.Foods
            .Where(f => !string.IsNullOrEmpty(f.FoodCategory))
            .Select(f => f.FoodCategory!)
            .Distinct()
            .ToList()
    };
}
