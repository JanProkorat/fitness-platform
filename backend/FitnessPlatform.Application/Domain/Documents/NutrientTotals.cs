using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Computed macro totals for a meal or day.
/// </summary>
public class NutrientTotals
{
    /// <summary>
    /// Total kilocalories.
    /// </summary>
    [BsonElement("kcal")]
    public decimal Kcal { get; set; }

    /// <summary>
    /// Total protein in grams.
    /// </summary>
    [BsonElement("protein")]
    public decimal Protein { get; set; }

    /// <summary>
    /// Total carbohydrates in grams.
    /// </summary>
    [BsonElement("carbs")]
    public decimal Carbs { get; set; }

    /// <summary>
    /// Total fat in grams.
    /// </summary>
    [BsonElement("fat")]
    public decimal Fat { get; set; }

    /// <summary>
    /// Total dietary fiber in grams.
    /// </summary>
    [BsonElement("fiber")]
    public decimal Fiber { get; set; }
}
