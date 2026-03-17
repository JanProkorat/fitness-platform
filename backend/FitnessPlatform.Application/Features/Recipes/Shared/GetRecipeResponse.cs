using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.Recipes.Shared;

/// <summary>
/// Full recipe detail returned by get and create/update endpoints.
/// </summary>
public class GetRecipeResponse
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
    /// Optional description or preparation instructions.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// List of food items with denormalized nutrient snapshots.
    /// </summary>
    public List<MealFood> Foods { get; set; } = [];

    /// <summary>
    /// Computed total macronutrients for the entire recipe.
    /// </summary>
    public NutrientTotals TotalNutrients { get; set; } = new();

    /// <summary>
    /// When the recipe was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When the recipe was last updated.
    /// </summary>
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Maps a <see cref="Recipe"/> document to a <see cref="GetRecipeResponse"/>.
    /// </summary>
    /// <param name="recipe">The source recipe document.</param>
    /// <returns>A full recipe response.</returns>
    public static GetRecipeResponse FromDocument(Recipe recipe) => new()
    {
        RecipeId = recipe.ExternalId,
        Name = recipe.Name,
        Description = recipe.Description,
        Foods = recipe.Foods,
        TotalNutrients = recipe.TotalNutrients,
        DateCreated = recipe.DateCreated,
        DateUpdated = recipe.DateUpdated
    };
}
