using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A food a client ate outside the plan, embedded in a <see cref="DayLog"/>. Kcal and macros are
/// snapshotted from the Food document at add time.
/// </summary>
public class OffPlanFoodEntry
{
    /// <summary>Stable identifier of this entry within the day log.</summary>
    [BsonElement("entryId")]
    public Guid EntryId { get; set; } = Guid.NewGuid();

    /// <summary>The Food document's ExternalId.</summary>
    [BsonElement("foodExternalId")]
    public Guid FoodExternalId { get; set; }

    /// <summary>Snapshot of the food name.</summary>
    [BsonElement("foodName")]
    public string FoodName { get; set; } = string.Empty;

    /// <summary>Snapshot of the food category.</summary>
    [BsonElement("foodCategory")]
    [BsonIgnoreIfNull]
    public string? FoodCategory { get; set; }

    /// <summary>Amount eaten in grams.</summary>
    [BsonElement("amountGrams")]
    public decimal AmountGrams { get; set; }

    /// <summary>Kilocalories for the eaten amount.</summary>
    [BsonElement("kcal")]
    public decimal Kcal { get; set; }

    /// <summary>Protein in grams for the eaten amount.</summary>
    [BsonElement("protein")]
    public decimal Protein { get; set; }

    /// <summary>Carbohydrates in grams for the eaten amount.</summary>
    [BsonElement("carbs")]
    public decimal Carbs { get; set; }

    /// <summary>Fat in grams for the eaten amount.</summary>
    [BsonElement("fat")]
    public decimal Fat { get; set; }

    /// <summary>Fiber in grams for the eaten amount.</summary>
    [BsonElement("fiber")]
    public decimal Fiber { get; set; }

    /// <summary>UTC time the entry was added.</summary>
    [BsonElement("loggedAt")]
    public DateTime LoggedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// The <c>NutritionPlan.Version</c> the client saw when it queued this entry offline.
    /// Null when the client did not send one.
    /// </summary>
    [BsonElement("basedOnPlanVersion")]
    [BsonIgnoreIfNull]
    public int? BasedOnPlanVersion { get; set; }
}
