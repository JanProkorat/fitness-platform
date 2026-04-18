using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB root aggregate tracking which exercises (and optionally sets) a client
/// has completed for a specific training session on a specific calendar date.
///
/// <para>
/// <b>Document shape chosen:</b> one document per (clientId, date, sessionId).
/// This is the cheapest shape for the two most common read paths:
/// (1) "did the client finish session X today?" — a single document lookup with a compound index;
/// (2) compliance roll-up — an indexed scan by (clientId, date) returns one document per session,
///     allowing the service to count completed sessions without pulling every exercise.
/// The alternative "one doc per (clientId, date)" with nested sessions would save one index entry
/// per day but would create wider documents and make fan-out writes (MarkWholeDayComplete) heavier
/// with multiple UpdateOne calls replaced by a single FindOneAndReplace, which isn't clearly cheaper.
/// </para>
/// </summary>
public class TrainingCompletion
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
    /// The client this completion record belongs to (matches ApplicationUser.PublicId / ClientProfile.PublicId).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// The calendar date (midnight UTC) for which this completion applies.
    /// </summary>
    [BsonElement("date")]
    public DateTime Date { get; set; }

    /// <summary>
    /// The session (from the training plan) that was completed.
    /// Matches <see cref="TrainingSession.SessionId"/>.
    /// </summary>
    [BsonElement("sessionId")]
    public Guid SessionId { get; set; }

    /// <summary>
    /// List of exercise external IDs that have been marked complete for this session on this date.
    /// </summary>
    [BsonElement("completedExerciseIds")]
    public List<Guid> CompletedExerciseIds { get; set; } = [];

    /// <summary>
    /// Optional per-set completion data, keyed by exerciseExternalId.
    /// Each entry is the set of 1-based set numbers that were completed.
    /// Only populated when the client uses set-level tracking; absence means the
    /// exercise was marked complete at the exercise level only.
    /// </summary>
    [BsonElement("completedSets")]
    [BsonIgnoreIfNull]
    public Dictionary<string, List<int>>? CompletedSets { get; set; }

    /// <summary>
    /// When the first completion was recorded for this session-date combination.
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}
