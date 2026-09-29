using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document holding the full set of <see cref="FoodTag"/> ids a coach has assigned to one
/// food. Exactly one document per (<see cref="OwnerUserId"/>, <see cref="FoodExternalId"/>) pair —
/// replacing the set is a single atomic upsert, never a per-tag row.
/// </summary>
[BsonIgnoreExtraElements]
public class FoodTagAssignment
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>
    /// Owning nutritionist — matches <c>ApplicationUser.Id</c> (the UserId claim). Scopes every
    /// read and write; a tag never crosses to another coach's assignment.
    /// </summary>
    [BsonElement("ownerUserId")]
    public Guid OwnerUserId { get; set; }

    /// <summary>
    /// The tagged food's <see cref="Food.ExternalId"/>. The food itself may be the owner's own,
    /// a platform system food, or another coach's Public food — tagging is relationship metadata
    /// the tagging coach keeps for themselves, not a claim of ownership over the food.
    /// </summary>
    [BsonElement("foodExternalId")]
    public Guid FoodExternalId { get; set; }

    /// <summary>
    /// The full set of <see cref="FoodTag.ExternalId"/> values currently assigned. Replaced
    /// wholesale on every write — never patched tag-by-tag.
    /// </summary>
    [BsonElement("tagIds")]
    public List<Guid> TagIds { get; set; } = [];

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
