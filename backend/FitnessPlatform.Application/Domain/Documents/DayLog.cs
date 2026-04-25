using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document recording a client's day-level diary entry (photos + note) for a whole plan day.
/// Keyed by <c>(ClientId, PlanId, LogDate)</c> — one document per client per day per plan.
/// </summary>
public class DayLog
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Stable public identifier for external references.
    /// </summary>
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; } = Guid.NewGuid();

    /// <summary>
    /// The client who owns this day log (matches ClientProfile.PublicId).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// Reference to the active NutritionPlan's ExternalId.
    /// </summary>
    [BsonElement("planId")]
    public Guid PlanId { get; set; }

    /// <summary>
    /// The calendar date (UTC midnight) this day log belongs to.
    /// Used as the primary key for the "one log per day per plan" invariant.
    /// </summary>
    [BsonElement("logDate")]
    public DateTime LogDate { get; set; }

    /// <summary>
    /// Day-level photos attached to this diary entry.
    /// These are plan-scoped photos (Fotky plánu) as opposed to per-meal photos.
    /// </summary>
    [BsonElement("photos")]
    public List<DayPhoto> Photos { get; set; } = [];

    /// <summary>
    /// Optional free-text note at the day level (max 500 chars).
    /// Null on documents that have no note — backward compatible.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }

    /// <summary>
    /// Optimistic-concurrency version counter. Bumped on every write.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;

    /// <summary>
    /// UTC timestamp when this document was first created.
    /// </summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// UTC timestamp of the most recent update.
    /// </summary>
    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// A single photo reference attached to a <see cref="DayLog"/> entry.
/// </summary>
public class DayPhoto
{
    /// <summary>
    /// The MinIO blob URL for this photo, as returned by the signed-URL upload helper.
    /// Blob path follows the <c>plan-photos/{planId}/{guid}.{ext}</c> convention.
    /// </summary>
    [BsonElement("blobUrl")]
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the photo was uploaded/persisted.
    /// Preserved across re-saves for unchanged URLs.
    /// </summary>
    [BsonElement("uploadedAt")]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Optional per-photo caption (max 500 chars).
    /// Null on documents with no caption — backward compatible.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }

    /// <summary>
    /// Categorises this photo for display grouping in the app (Food / Progress / Free).
    /// </summary>
    [BsonElement("category")]
    public DayPhotoCategory Category { get; set; } = DayPhotoCategory.Free;
}

/// <summary>
/// Display category for a <see cref="DayPhoto"/>.
/// Maps to the three chips shown in the Fotky plánu gallery (Jídlo / Postup / Volné).
/// </summary>
public enum DayPhotoCategory
{
    /// <summary>Food-related photo (Jídlo).</summary>
    Food,

    /// <summary>Progress/body photo (Postup).</summary>
    Progress,

    /// <summary>Uncategorised / free-form photo (Volné).</summary>
    Free,
}
