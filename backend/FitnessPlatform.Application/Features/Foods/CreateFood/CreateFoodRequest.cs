using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Application.Features.Foods.CreateFood;

/// <summary>
/// Request model for creating a custom food.
/// </summary>
public class CreateFoodRequest
{
    /// <summary>
    /// Name of the food item.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional English name.
    /// </summary>
    public string? NameEn { get; set; }

    /// <summary>
    /// Optional Czech name.
    /// </summary>
    public string? NameCs { get; set; }

    /// <summary>
    /// Optional German name.
    /// </summary>
    public string? NameDe { get; set; }

    /// <summary>
    /// Nutritional values per 100 grams.
    /// </summary>
    public NutrientValueDto NutrientValue { get; set; } = new();

    /// <summary>
    /// Food category.
    /// </summary>
    public FoodCategory Category { get; set; } = FoodCategory.Other;

    /// <summary>
    /// Visibility of the food. Defaults to <see cref="FoodVisibility.Private"/> when omitted —
    /// a coach-authored ingredient starts out visible only to its creator.
    /// </summary>
    public FoodVisibility Visibility { get; set; } = FoodVisibility.Private;

    /// <summary>
    /// Optional user note.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Allergens contained in this food.
    /// </summary>
    public List<Allergen> Allergens { get; set; } = [];

    /// <summary>
    /// Dietary preferences this food satisfies.
    /// </summary>
    public List<DietaryPreference> DietaryPreferences { get; set; } = [];

    /// <summary>
    /// Common serving sizes. The first entry is the default serving and is required.
    /// </summary>
    public List<ServingSizeDto> CommonServings { get; set; } = [];
}
