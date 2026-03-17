using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Embedded document with nutritional values per 100 grams.
/// </summary>
public class NutrientValue
{
    /// <summary>
    /// Energy in kilocalories.
    /// </summary>
    [BsonElement("kcal")]
    public decimal Kcal { get; set; }

    /// <summary>
    /// Protein in grams.
    /// </summary>
    [BsonElement("protein")]
    public decimal Protein { get; set; }

    /// <summary>
    /// Carbohydrates in grams.
    /// </summary>
    [BsonElement("carbs")]
    public decimal Carbs { get; set; }

    /// <summary>
    /// Total fat in grams.
    /// </summary>
    [BsonElement("fat")]
    public decimal Fat { get; set; }

    /// <summary>
    /// Dietary fiber in grams.
    /// </summary>
    [BsonElement("fiber")]
    public decimal? Fiber { get; set; }

    /// <summary>
    /// Sugar in grams.
    /// </summary>
    [BsonElement("sugar")]
    public decimal? Sugar { get; set; }

    /// <summary>
    /// Saturated fat in grams.
    /// </summary>
    [BsonElement("saturatedFat")]
    public decimal? SaturatedFat { get; set; }

    /// <summary>
    /// Salt in grams.
    /// </summary>
    [BsonElement("salt")]
    public decimal? Salt { get; set; }
}
