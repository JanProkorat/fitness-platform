namespace FitnessPlatform.Application.Features.Recipes.Shared;

/// <summary>
/// Input DTO representing a food item to include in a recipe.
/// </summary>
public class RecipeFoodDto
{
    /// <summary>
    /// External identifier of the food to add.
    /// </summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>
    /// Amount of this food in grams.
    /// </summary>
    public decimal AmountGrams { get; set; }

    /// <summary>
    /// Optional note for this ingredient (e.g. preparation tip, substitution hint).
    /// </summary>
    public string? Note { get; set; }
}
