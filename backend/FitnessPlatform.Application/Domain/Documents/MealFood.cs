using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A food item within a meal — denormalized snapshot of food data at the time of addition.
/// </summary>
public class MealFood
{
    /// <summary>
    /// Reference to the original food document's ExternalId.
    /// </summary>
    [BsonElement("foodExternalId")]
    public Guid FoodExternalId { get; set; }

    /// <summary>
    /// Snapshot of the food name at time of addition.
    /// </summary>
    [BsonElement("foodName")]
    public string FoodName { get; set; } = string.Empty;

    /// <summary>
    /// Snapshot of nutritional values per 100 grams at time of addition.
    /// </summary>
    [BsonElement("nutrientValuePer100Grams")]
    public NutrientValue NutrientValuePer100Grams { get; set; } = new();

    /// <summary>
    /// Amount of this food in grams.
    /// </summary>
    [BsonElement("amountGrams")]
    public decimal AmountGrams { get; set; }

    /// <summary>
    /// Optional note for this food in the plan.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }
}
