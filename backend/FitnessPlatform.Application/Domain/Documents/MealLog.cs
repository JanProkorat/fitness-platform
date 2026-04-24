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
    /// The calendar date (UTC) this log entry belongs to — always set regardless of
    /// whether the meal has been marked as eaten. Used to key the "one log per day per
    /// meal" invariant enforced by the AttachMealPhotos endpoint.
    /// </summary>
    [BsonElement("logDate")]
    public DateTime LogDate { get; set; }

    /// <summary>
    /// When the meal was eaten. Null for photo-only / note-only log entries that have
    /// not yet been confirmed as eaten via the LogMealEaten endpoint.
    /// </summary>
    [BsonElement("eatenAt")]
    [BsonIgnoreIfNull]
    public DateTime? EatenAt { get; set; }

    /// <summary>
    /// Snapshot of foods actually consumed (may differ from plan).
    /// </summary>
    [BsonElement("foodsEaten")]
    public List<MealFood> FoodsEaten { get; set; } = [];

    /// <summary>
    /// Photos attached to this meal log entry.
    /// Each photo is a reference to a blob URL in MinIO uploaded via the
    /// signed-URL flow from Epic #65. Defaults to empty list on existing docs.
    /// </summary>
    [BsonElement("photos")]
    public List<MealPhoto> Photos { get; set; } = [];

    /// <summary>
    /// Optional free-text note the client can attach to a meal log (max 500 chars).
    /// Null on existing docs — backward compatible.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }
}

/// <summary>
/// A photo reference attached to a <see cref="MealLog"/> entry.
/// </summary>
public class MealPhoto
{
    /// <summary>
    /// The MinIO blob URL for this photo, as returned by the signed-URL upload helper.
    /// </summary>
    [BsonElement("blobUrl")]
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the photo was uploaded/persisted.
    /// </summary>
    [BsonElement("uploadedAt")]
    public DateTime UploadedAt { get; set; }
}
