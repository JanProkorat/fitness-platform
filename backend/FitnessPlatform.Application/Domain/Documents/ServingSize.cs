using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Embedded document representing a common serving size for a food item.
/// </summary>
public class ServingSize
{
    /// <summary>
    /// Human-readable label (e.g. "1 medium banana", "1 slice").
    /// </summary>
    [BsonElement("label")]
    public string Label { get; set; } = string.Empty;

    /// <summary>
    /// Weight of this serving in grams.
    /// </summary>
    [BsonElement("weightGrams")]
    public decimal WeightGrams { get; set; }
}
