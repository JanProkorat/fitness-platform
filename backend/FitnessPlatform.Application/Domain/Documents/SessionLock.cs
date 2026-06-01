using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing an active session lock.
/// A lock doc exists only while the session is in <c>Editing</c> or <c>Live</c> state.
/// Absence of a document means the session is <c>Stable</c> (safe to start).
/// </summary>
public class SessionLock
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>
    /// The <c>TrainingSession.SessionId</c> this lock guards. Carries a unique index.
    /// </summary>
    [BsonElement("sessionId")]
    public Guid SessionId { get; set; }

    /// <summary>
    /// The <c>TrainingPlan.ExternalId</c> the session belongs to.
    /// Used to fan out state reads for an entire plan.
    /// </summary>
    [BsonElement("planId")]
    public Guid PlanId { get; set; }

    /// <summary>
    /// The client user id (matches <c>ApplicationUser.Id</c>).
    /// Used for SignalR fan-out to the client when lock state changes.
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// The trainer user id (matches <c>ApplicationUser.Id</c>).
    /// Used for SignalR fan-out to the trainer when lock state changes.
    /// </summary>
    [BsonElement("trainerId")]
    public Guid TrainerId { get; set; }

    /// <summary>
    /// Which party holds this lock: <c>Coach</c> for Editing, <c>Client</c> for Live.
    /// </summary>
    [BsonElement("holder")]
    [BsonRepresentation(BsonType.String)]
    public LockHolder Holder { get; set; }

    /// <summary>
    /// The mode of the lock: <c>Editing</c> or <c>Live</c>.
    /// </summary>
    [BsonElement("type")]
    [BsonRepresentation(BsonType.String)]
    public LockType Type { get; set; }

    /// <summary>
    /// UTC timestamp when the lock was first acquired.
    /// </summary>
    [BsonElement("acquiredAt")]
    public DateTime AcquiredAt { get; set; }

    /// <summary>
    /// UTC timestamp after which this lock is considered expired.
    /// Carries a TTL index (<c>expireAfterSeconds: 0</c>) so Mongo automatically
    /// deletes the document when this field passes. Query-layer checks also
    /// filter <c>expiresAt &gt; now</c> so expiry is correct before the ~60s reaper runs.
    /// </summary>
    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }
}
