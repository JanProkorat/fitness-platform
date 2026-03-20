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
    /// Updated barcode.
    /// </summary>
    public string? Barcode { get; set; }

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
    /// Updated allergen identifiers.
    /// </summary>
    public List<string> Allergens { get; set; } = [];

    /// <summary>
    /// Updated common serving sizes.
    /// </summary>
    public List<ServingSizeDto> CommonServings { get; set; } = [];
}
