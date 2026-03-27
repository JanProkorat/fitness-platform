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
    /// Optional user note.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Allergen identifiers.
    /// </summary>
    public List<string> Allergens { get; set; } = [];

    /// <summary>
    /// Common serving sizes.
    /// </summary>
    public List<ServingSizeDto> CommonServings { get; set; } = [];
}
