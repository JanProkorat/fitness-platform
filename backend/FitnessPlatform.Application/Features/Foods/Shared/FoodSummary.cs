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
    /// Resolved food name for display (localized based on Accept-Language).
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Original (canonical) food name, unaffected by language resolution.
    /// </summary>
    public string RawName { get; set; } = string.Empty;

    /// <summary>
    /// English name, if available.
    /// </summary>
    public string? NameEn { get; set; }

    /// <summary>
    /// Czech name, if available.
    /// </summary>
    public string? NameCs { get; set; }

    /// <summary>
    /// German name, if available.
    /// </summary>
    public string? NameDe { get; set; }

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
    /// Optional user note.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Maps a <see cref="Food"/> document to a <see cref="FoodSummary"/> DTO.
    /// </summary>
    /// <param name="food">The food document.</param>
    /// <param name="language">Two-letter language code for name resolution (e.g. "cs", "de"). Defaults to "en".</param>
    public static FoodSummary FromDocument(Food food, string? language = null) => new()
    {
        FoodId = food.ExternalId,
        Name = food.LocalizedNames?.Resolve(language) ?? food.Name,
        RawName = food.Name,
        NameEn = food.LocalizedNames?.En,
        NameCs = food.LocalizedNames?.Cs,
        NameDe = food.LocalizedNames?.De,
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
        Note = food.Note,
        Allergens = food.Allergens,
        CommonServings = food.CommonServings
            .Select(s => new ServingSizeDto { Label = s.Label, WeightGrams = s.WeightGrams })
            .ToList()
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
