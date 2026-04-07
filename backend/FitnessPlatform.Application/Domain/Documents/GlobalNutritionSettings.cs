using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Global daily nutrition targets for a plan.
/// </summary>
public class GlobalNutritionSettings
{
    /// <summary>
    /// Target daily kilocalories.
    /// </summary>
    [BsonElement("dailyKcal")]
    public decimal? DailyKcal { get; set; }

    /// <summary>
    /// Target daily protein in grams.
    /// </summary>
    [BsonElement("proteinGrams")]
    public decimal? ProteinGrams { get; set; }

    /// <summary>
    /// Target daily carbohydrates in grams.
    /// </summary>
    [BsonElement("carbsGrams")]
    public decimal? CarbsGrams { get; set; }

    /// <summary>
    /// Target daily fat in grams.
    /// </summary>
    [BsonElement("fatGrams")]
    public decimal? FatGrams { get; set; }

    /// <summary>
    /// Target daily dietary fiber in grams.
    /// </summary>
    [BsonElement("fiberGrams")]
    public decimal? FiberGrams { get; set; }
}
