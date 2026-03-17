using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document recording a client's consumed meal.
/// Stored in a separate collection that grows unboundedly, queried by date range.
/// </summary>
public class MealLog
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>
    /// The client who ate the meal (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// Reference to the nutrition plan's ExternalId.
    /// </summary>
    [BsonElement("planId")]
    public Guid PlanId { get; set; }

    /// <summary>
    /// Reference to the PlanMeal's MealId.
    /// </summary>
    [BsonElement("mealId")]
    public Guid MealId { get; set; }

    /// <summary>
    /// When the meal was eaten.
    /// </summary>
    [BsonElement("eatenAt")]
    public DateTime EatenAt { get; set; }

    /// <summary>
    /// Snapshot of foods actually consumed (may differ from plan).
    /// </summary>
    [BsonElement("foodsEaten")]
    public List<MealFood> FoodsEaten { get; set; } = [];
}
