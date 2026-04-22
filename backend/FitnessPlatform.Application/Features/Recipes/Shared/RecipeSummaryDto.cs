using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

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
    /// Visibility of the recipe (Public = visible to all nutritionists, Private = visible only to its creator).
    /// </summary>
    public RecipeVisibility Visibility { get; set; }

    /// <summary>
    /// URL of the recipe's main image, or null if no image has been uploaded.
    /// </summary>
    public string? ImageUrl { get; set; }

    /// <summary>
    /// True when the authenticated caller is the nutritionist who created this recipe.
    /// </summary>
    public bool IsOwnedByCurrentUser { get; set; }

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
    /// <param name="currentUserId">Id of the authenticated user; used to resolve <see cref="IsOwnedByCurrentUser"/>.</param>
    /// <returns>A summary DTO.</returns>
    public static RecipeSummaryDto FromDocument(Recipe recipe, Guid? currentUserId = null) => new()
    {
        RecipeId = recipe.ExternalId,
        Name = recipe.Name,
        FoodCount = recipe.Foods.Count,
        TotalNutrients = recipe.TotalNutrients,
        PrepTimeMinutes = recipe.PrepTimeMinutes,
        Visibility = recipe.Visibility,
        ImageUrl = recipe.ImageUrl,
        IsOwnedByCurrentUser = currentUserId.HasValue && recipe.NutritionistId == currentUserId.Value,
        DateCreated = recipe.DateCreated,
        FoodCategories = recipe.Foods
            .Where(f => !string.IsNullOrEmpty(f.FoodCategory))
            .Select(f => f.FoodCategory!)
            .Distinct()
            .ToList()
    };
}
