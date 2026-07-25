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
/// <remarks>
/// <b>Deprecated (#841).</b> Superseded by <see cref="SessionExecution"/>, which unifies this
/// document with <see cref="WorkoutLog"/>. The <c>trainingCompletions</c> collection is kept
/// read-only (no new writes) for one release as the rollback path for the
/// <c>--migrate-session-executions</c> data migration — do not add new write sites against this
/// type. Scheduled for removal in a follow-up chore once production has soaked on the merged
/// model.
/// </remarks>
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
    /// The client this completion record belongs to (matches ApplicationUser.Id — #840).
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
    /// <para>
    /// <b>Deprecated.</b> New writes populate <see cref="CompletedExerciseIdsBySection"/> instead.
    /// This flat list is kept for back-compat reads of historical data; it is mirrored from the new
    /// dict so that legacy readers continue to work. Use
    /// <c>TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection</c> for a
    /// merged, section-aware view.
    /// </para>
    /// </summary>
    [BsonElement("completedExerciseIds")]
    public List<Guid> CompletedExerciseIds { get; set; } = [];

    /// <summary>
    /// Per-section completed exercise IDs. Key = <see cref="TrainingSection.SectionId"/> serialized
    /// as a lowercase string (e.g. "3f2504e0-4f89-11d3-9a0c-0305e82c3301"), value = list of
    /// <see cref="SessionExercise.ExerciseExternalId"/> values completed within that specific section instance.
    /// <para>
    /// String keys are used because MongoDB's default <c>DictionaryRepresentation.Document</c> requires
    /// document-key values to be strings; <c>Guid</c> keys cause a <c>BsonSerializationException</c>
    /// on <c>UpdateOneAsync</c>. Callers that need <c>Guid</c> keys use
    /// <c>Guid.Parse(key)</c> when reading. See <c>TrainingCompletionBackfill</c>.
    /// </para>
    /// <para>
    /// This is the authoritative field for section-aware completion tracking. Populated by new writes.
    /// When absent (legacy documents) <c>TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection</c>
    /// attributes each id in <see cref="CompletedExerciseIds"/> to the first section in the session
    /// that contains it.
    /// </para>
    /// </summary>
    [BsonElement("completedExerciseIdsBySection")]
    [BsonIgnoreIfNull]
    public Dictionary<string, List<Guid>>? CompletedExerciseIdsBySection { get; set; }

    /// <summary>
    /// Section IDs (matching <see cref="TrainingSection.SectionId"/>) that the
    /// client has marked complete on this date. Used for sections that don't
    /// track at the exercise level — ForTime workouts that are just a name +
    /// time cap, e.g. "Running".
    /// </summary>
    [BsonElement("completedSectionIds")]
    [BsonIgnoreIfNull]
    public List<Guid>? CompletedSectionIds { get; set; }

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
