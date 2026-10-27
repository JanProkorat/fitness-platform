using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A ticked shopping-list item. One document per (client, plan, week number, food).
/// </summary>
public class ShoppingListTick
{
    /// <summary>MongoDB internal identifier.</summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>The client who ticked the item (ApplicationUser.Id).</summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>The nutrition plan's ExternalId.</summary>
    [BsonElement("planId")]
    public Guid PlanId { get; set; }

    /// <summary>Week number within the plan (1-based).</summary>
    [BsonElement("weekNumber")]
    public int WeekNumber { get; set; }

    /// <summary>The ticked food's ExternalId.</summary>
    [BsonElement("foodExternalId")]
    public Guid FoodExternalId { get; set; }

    /// <summary>UTC time the item was first ticked.</summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
