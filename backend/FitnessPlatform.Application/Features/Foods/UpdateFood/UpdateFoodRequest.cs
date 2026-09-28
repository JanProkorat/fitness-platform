using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Application.Features.Foods.UpdateFood;

/// <summary>
/// Request model for updating a custom food.
/// </summary>
public class UpdateFoodRequest
{
    /// <summary>
    /// The food's public identifier (from route).
    /// </summary>
    public Guid FoodId { get; set; }

    /// <summary>
    /// Updated food name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated English name.
    /// </summary>
    public string? NameEn { get; set; }

    /// <summary>
    /// Updated Czech name.
    /// </summary>
    public string? NameCs { get; set; }

    /// <summary>
    /// Updated German name.
    /// </summary>
    public string? NameDe { get; set; }

    /// <summary>
    /// Updated nutritional values per 100 grams.
    /// </summary>
    public NutrientValueDto NutrientValue { get; set; } = new();

    /// <summary>
    /// Updated food category.
    /// </summary>
    public FoodCategory Category { get; set; } = FoodCategory.Other;

    /// <summary>
    /// Updated visibility. When omitted, the food's existing visibility is preserved.
    /// Only the food's creator can change this value.
    /// </summary>
    public FoodVisibility? Visibility { get; set; }

    /// <summary>
    /// Updated user note.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Updated allergens contained in this food.
    /// </summary>
    public List<Allergen> Allergens { get; set; } = [];

    /// <summary>
    /// Updated dietary preferences this food satisfies.
    /// </summary>
    public List<DietaryPreference> DietaryPreferences { get; set; } = [];

    /// <summary>
    /// Updated free-form tags for filtering and classification.
    /// </summary>
    public List<string> Tags { get; set; } = [];

    /// <summary>
    /// Updated common serving sizes. The first entry is the default serving and is required.
    /// </summary>
    public List<ServingSizeDto> CommonServings { get; set; } = [];
}
