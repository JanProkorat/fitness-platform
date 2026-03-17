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
    /// Optional barcode.
    /// </summary>
    public string? Barcode { get; set; }

    /// <summary>
    /// Nutritional values per 100 grams.
    /// </summary>
    public NutrientValueDto NutrientValue { get; set; } = new();

    /// <summary>
    /// Allergen identifiers.
    /// </summary>
    public List<string> Allergens { get; set; } = [];

    /// <summary>
    /// Common serving sizes.
    /// </summary>
    public List<ServingSizeDto> CommonServings { get; set; } = [];
}
