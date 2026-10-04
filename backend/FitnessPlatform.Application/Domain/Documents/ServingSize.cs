using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Embedded document representing a common serving size for a food item.
/// </summary>
public class ServingSize
{
    /// <summary>
    /// For seeded foods, a <see cref="FitnessPlatform.Application.Domain.Constants.ServingUnits"/>
    /// key (e.g. "piece", "slice"), translated client-side. Legacy owned foods may still carry
    /// free text (e.g. "1 bar (~60g)").
    /// </summary>
    [BsonElement("label")]
    public string Label { get; set; } = string.Empty;

    /// <summary>
    /// Weight of this serving in grams.
    /// </summary>
    [BsonElement("weightGrams")]
    public decimal WeightGrams { get; set; }
}
