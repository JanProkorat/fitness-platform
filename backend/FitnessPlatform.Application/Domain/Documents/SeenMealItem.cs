using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// One item of the meal as the client saw it offline, kept on an <see cref="OfflineSyncConflict"/>.
/// </summary>
public class SeenMealItem
{
    /// <summary>Whether the item was a food or a recipe.</summary>
    [BsonElement("kind")]
    [BsonRepresentation(BsonType.String)]
    public SeenMealItemKind Kind { get; set; }

    /// <summary>Public id of the food or recipe.</summary>
    [BsonElement("refId")]
    public Guid RefId { get; set; }

    /// <summary>Display name the client showed.</summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Amount the client showed.</summary>
    [BsonElement("amount")]
    public decimal Amount { get; set; }

    /// <summary>Energy the client showed, in kcal.</summary>
    [BsonElement("kcal")]
    public decimal Kcal { get; set; }
}
