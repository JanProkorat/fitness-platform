using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document recording photos and notes attached to a specific training session diary entry.
/// Keyed by <c>(ClientId, PlanId, SessionId, LogDate)</c> — one document per client per session per calendar day.
/// <para>
/// <b>ClientId</b> stores <c>ApplicationUser.Id</c> (#840) — the same convention every other
/// Mongo document's clientId field uses, including <see cref="WorkoutLog"/>.
/// </para>
/// </summary>
public class SessionLog
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>
    /// The client who owns this log entry — stores <c>ApplicationUser.Id</c>.
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// Reference to the training plan's ExternalId.
    /// </summary>
    [BsonElement("planId")]
    public Guid PlanId { get; set; }

    /// <summary>
    /// Reference to the <see cref="TrainingSession.SessionId"/> this log belongs to.
    /// </summary>
    [BsonElement("sessionId")]
    public Guid SessionId { get; set; }

    /// <summary>
    /// The calendar date (UTC) this log entry belongs to.
    /// Used to key the "one log per day per session" invariant.
    /// </summary>
    [BsonElement("logDate")]
    public DateTime LogDate { get; set; }

    /// <summary>
    /// Photos attached to this session log entry.
    /// Each photo is a reference to a blob URL in MinIO uploaded via the signed-URL flow.
    /// </summary>
    [BsonElement("photos")]
    public List<SessionPhoto> Photos { get; set; } = [];

    /// <summary>
    /// Optional free-text note the client can attach to a session log (max 500 chars).
    /// Null on existing docs — backward compatible.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }

    /// <summary>
    /// UTC timestamp when the document was created.
    /// </summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// UTC timestamp when the document was last updated.
    /// </summary>
    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}

/// <summary>
/// A photo reference attached to a <see cref="SessionLog"/> entry.
/// </summary>
public class SessionPhoto
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

    /// <summary>
    /// Optional caption / per-photo note (max 500 chars).
    /// Null on existing documents — backward compatible.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }
}
