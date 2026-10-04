using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a coach-private food tag. Owned by a single
/// <see cref="Entities.ApplicationUser"/> (a nutritionist) — never shared across coaches.
/// </summary>
[BsonIgnoreExtraElements]
public class FoodTag
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>
    /// Public-facing identifier used in API requests and responses.
    /// </summary>
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <summary>
    /// Owning nutritionist — matches <c>ApplicationUser.Id</c> (the UserId claim), the same key
    /// <see cref="Food.NutritionistId"/> uses.
    /// </summary>
    [BsonElement("ownerUserId")]
    public Guid OwnerUserId { get; set; }

    /// <summary>
    /// Tag label.
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Trimmed, lowercased <see cref="Name"/> — backs the case-insensitive per-owner uniqueness
    /// index so "Keto" and "keto" collide.
    /// </summary>
    [BsonElement("normalizedName")]
    public string NormalizedName { get; set; } = string.Empty;

    /// <summary>
    /// Display color as a lowercase 6-digit hex string, e.g. <c>"#3b82f6"</c>.
    /// </summary>
    [BsonElement("colorHex")]
    public string ColorHex { get; set; } = string.Empty;

    /// <summary>
    /// Optional free-text description.
    /// </summary>
    [BsonElement("description")]
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    /// <summary>
    /// Incremented on every rename/recolor. Audit-only — no endpoint gates a write on a stale
    /// value today.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;

    /// <summary>
    /// When this document was created.
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }
}
