using System.Text.Json.Serialization;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Response from the Open Food Facts product (barcode) endpoint.
/// </summary>
public sealed class OffProductResponse
{
    /// <summary>
    /// 1 = product found, 0 = not found.
    /// </summary>
    [JsonPropertyName("status")]
    public int Status { get; set; }

    /// <summary>
    /// The product data, if found.
    /// </summary>
    [JsonPropertyName("product")]
    public OffProduct? Product { get; set; }
}

/// <summary>
/// Response from the Open Food Facts search endpoint.
/// </summary>
public sealed class OffSearchResponse
{
    /// <summary>
    /// Total number of matching products.
    /// </summary>
    [JsonPropertyName("count")]
    public int Count { get; set; }

    /// <summary>
    /// The list of matching products.
    /// </summary>
    [JsonPropertyName("products")]
    public List<OffProduct> Products { get; set; } = [];
}

/// <summary>
/// A single product from the Open Food Facts API.
/// </summary>
public sealed class OffProduct
{
    /// <summary>
    /// The EAN/UPC barcode.
    /// </summary>
    [JsonPropertyName("code")]
    public string? Code { get; set; }

    /// <summary>
    /// Product name.
    /// </summary>
    [JsonPropertyName("product_name")]
    public string? ProductName { get; set; }

    /// <summary>
    /// Nutrient values.
    /// </summary>
    [JsonPropertyName("nutriments")]
    public OffNutriments? Nutriments { get; set; }

    /// <summary>
    /// Allergen tags (e.g. "en:gluten", "en:milk").
    /// </summary>
    [JsonPropertyName("allergens_tags")]
    public List<string>? AllergensTags { get; set; }

    /// <summary>
    /// Serving size description (e.g. "30g", "1 bar (40g)").
    /// </summary>
    [JsonPropertyName("serving_size")]
    public string? ServingSize { get; set; }

    /// <summary>
    /// Serving weight in grams.
    /// </summary>
    [JsonPropertyName("serving_quantity")]
    public decimal? ServingQuantity { get; set; }

    /// <summary>
    /// English product name.
    /// </summary>
    [JsonPropertyName("product_name_en")]
    public string? ProductNameEn { get; set; }

    /// <summary>
    /// Czech product name.
    /// </summary>
    [JsonPropertyName("product_name_cs")]
    public string? ProductNameCs { get; set; }

    /// <summary>
    /// German product name.
    /// </summary>
    [JsonPropertyName("product_name_de")]
    public string? ProductNameDe { get; set; }
}

/// <summary>
/// Nutriment values from the Open Food Facts API (per 100 grams).
/// </summary>
public sealed class OffNutriments
{
    /// <summary>
    /// Energy in kcal per 100 grams.
    /// </summary>
    [JsonPropertyName("energy-kcal_100g")]
    public decimal? EnergyKcalPer100Grams { get; set; }

    /// <summary>
    /// Protein per 100 grams.
    /// </summary>
    [JsonPropertyName("proteins_100g")]
    public decimal? ProteinsPer100Grams { get; set; }

    /// <summary>
    /// Carbohydrates per 100 grams.
    /// </summary>
    [JsonPropertyName("carbohydrates_100g")]
    public decimal? CarbohydratesPer100Grams { get; set; }

    /// <summary>
    /// Fat per 100 grams.
    /// </summary>
    [JsonPropertyName("fat_100g")]
    public decimal? FatPer100Grams { get; set; }

    /// <summary>
    /// Fiber per 100 grams.
    /// </summary>
    [JsonPropertyName("fiber_100g")]
    public decimal? FiberPer100Grams { get; set; }

    /// <summary>
    /// Sugars per 100 grams.
    /// </summary>
    [JsonPropertyName("sugars_100g")]
    public decimal? SugarsPer100Grams { get; set; }

    /// <summary>
    /// Saturated fat per 100 grams.
    /// </summary>
    [JsonPropertyName("saturated-fat_100g")]
    public decimal? SaturatedFatPer100Grams { get; set; }

    /// <summary>
    /// Salt per 100 grams.
    /// </summary>
    [JsonPropertyName("salt_100g")]
    public decimal? SaltPer100Grams { get; set; }
}
