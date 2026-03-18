using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.Foods.Shared;

/// <summary>
/// Common response DTO for food items used across multiple endpoints.
/// </summary>
public class FoodSummary
{
    /// <summary>
    /// Public-facing food identifier.
    /// </summary>
    public Guid FoodId { get; set; }

    /// <summary>
    /// Food name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Data source: "system", "custom", or "openfoodfacts".
    /// </summary>
    public string? Source { get; set; }

    /// <summary>
    /// EAN/UPC barcode, if available.
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

    /// <summary>
    /// Whether this food has been verified.
    /// </summary>
    public bool IsVerified { get; set; }

    /// <summary>
    /// Maps a <see cref="Food"/> document to a <see cref="FoodSummary"/> DTO.
    /// </summary>
    /// <param name="food">The food document.</param>
    /// <param name="language">Two-letter language code for name resolution (e.g. "cs", "de"). Defaults to "en".</param>
    public static FoodSummary FromDocument(Food food, string? language = null) => new()
    {
        FoodId = food.ExternalId,
        Name = food.LocalizedNames?.Resolve(language) ?? food.Name,
        Source = food.Source,
        Barcode = food.Barcode,
        NutrientValue = new NutrientValueDto
        {
            Kcal = food.NutrientValue.Kcal,
            Protein = food.NutrientValue.Protein,
            Carbs = food.NutrientValue.Carbs,
            Fat = food.NutrientValue.Fat,
            Fiber = food.NutrientValue.Fiber,
            Sugar = food.NutrientValue.Sugar,
            SaturatedFat = food.NutrientValue.SaturatedFat,
            Salt = food.NutrientValue.Salt
        },
        Allergens = food.Allergens,
        CommonServings = food.CommonServings
            .Select(s => new ServingSizeDto { Label = s.Label, WeightGrams = s.WeightGrams })
            .ToList(),
        IsVerified = food.IsVerified
    };
}

/// <summary>
/// Nutrient values DTO for API responses.
/// </summary>
public class NutrientValueDto
{
    /// <summary>
    /// Energy in kilocalories per 100 grams.
    /// </summary>
    public decimal Kcal { get; set; }

    /// <summary>
    /// Protein in grams per 100 grams.
    /// </summary>
    public decimal Protein { get; set; }

    /// <summary>
    /// Carbohydrates in grams per 100 grams.
    /// </summary>
    public decimal Carbs { get; set; }

    /// <summary>
    /// Fat in grams per 100 grams.
    /// </summary>
    public decimal Fat { get; set; }

    /// <summary>
    /// Fiber in grams per 100 grams.
    /// </summary>
    public decimal? Fiber { get; set; }

    /// <summary>
    /// Sugar in grams per 100 grams.
    /// </summary>
    public decimal? Sugar { get; set; }

    /// <summary>
    /// Saturated fat in grams per 100 grams.
    /// </summary>
    public decimal? SaturatedFat { get; set; }

    /// <summary>
    /// Salt in grams per 100 grams.
    /// </summary>
    public decimal? Salt { get; set; }
}

/// <summary>
/// Serving size DTO for API responses.
/// </summary>
public class ServingSizeDto
{
    /// <summary>
    /// Human-readable label.
    /// </summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>
    /// Weight in grams.
    /// </summary>
    public decimal WeightGrams { get; set; }
}
