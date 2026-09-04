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
/// read-only (no new writes) — do not add new write sites against this type. The one-shot
/// migration that would have folded these documents into <see cref="SessionExecution"/> was
/// deleted in #848 (there was no data to migrate), so nothing writes here at all any more.
/// Scheduled for removal in a follow-up chore.
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
    /// Flat list of completed <see cref="SessionExercise.ExerciseId"/> instance values for this
    /// session on this date — both standalone exercises and exercises nested inside a workout.
    /// <para>
    /// Replaces the pre-#857-phase-3b <c>completedExerciseIdsBySection</c> dictionary (keyed by
    /// <see cref="TrainingWorkout.WorkoutId"/>, valued with catalog
    /// <see cref="SessionExercise.ExerciseExternalId"/>s), which could not distinguish two
    /// occurrences of the same catalog exercise within one workout or between a standalone
    /// occurrence and a nested one. See <see cref="SessionExecution.CompletedExerciseInstanceIds"/>
    /// for the live-model twin of this field.
    /// </para>
    /// </summary>
    [BsonElement("completedExerciseInstanceIds")]
    public List<Guid> CompletedExerciseInstanceIds { get; set; } = [];

    /// <summary>
    /// Workout IDs (matching <see cref="TrainingWorkout.WorkoutId"/>) that the
    /// client has marked complete on this date. Used for workouts that don't
    /// track at the exercise level — ForTime workouts that are just a name +
    /// time cap, e.g. "Running".
    /// </summary>
    [BsonElement("completedWorkoutIds")]
    [BsonIgnoreIfNull]
    public List<Guid>? CompletedWorkoutIds { get; set; }

    /// <summary>
    /// Optional per-set completion data, keyed by <see cref="SessionExercise.ExerciseExternalId"/>
    /// (serialized as a lowercase Guid string) — <b>NOT</b> rekeyed onto the per-instance
    /// <see cref="SessionExercise.ExerciseId"/> the way <see cref="CompletedExerciseInstanceIds"/>
    /// was. This document type is frozen/read-only (see class remarks) with no live write path,
    /// so no migration step exists (or ever ran) to resolve a catalog id against a specific plan
    /// session's instance ids here — see
    /// <see cref="SessionExecution.CompletedSets"/> for the full explanation and the matching
    /// reader in <c>GetFullTrainingPlanEndpoint</c>, which keys its lookup the same way.
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
