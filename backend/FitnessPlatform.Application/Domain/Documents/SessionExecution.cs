using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB root aggregate unifying the former <c>WorkoutLog</c> and <c>TrainingCompletion</c>
/// documents (#841) into a single per-(client, session, date) record of "what happened in this
/// training session on this day" — both the lightweight completion flags (Today-card checkboxes)
/// and the optional detailed set-by-set <see cref="SessionExecutionPerformance"/> (live training
/// assistant / trainer-driven retroactive finish).
/// </summary>
/// <remarks>
/// <para>
/// <b>Identity.</b> <see cref="ClientId"/> is always <c>ApplicationUser.Id</c> (matches both
/// legacy source documents post-#840). <see cref="PlanId"/>/<see cref="SessionId"/> are null for
/// ad-hoc (unplanned) workouts — those are exempt from the uniqueness constraint below.
/// </para>
/// <para>
/// <b>Uniqueness.</b> A partial-unique index on (<see cref="ClientId"/>, <see cref="SessionId"/>,
/// <see cref="Date"/>) — filtered to documents where both fields exist — enforces exactly ONE
/// execution per planned session per calendar day, regardless of whether it originated from a
/// checkbox toggle or a live workout. See <c>MongoIndexInitializer.CreateSessionExecutionIndexes</c>.
/// </para>
/// <para>
/// <b>Status.</b> <see cref="SessionExecutionStatus.Completed"/> means the session is fully done —
/// either <see cref="Performance"/>.CompletedAt is set (a finished live workout), or every
/// exercise/section in the plan's session definition is present in the completion flags below
/// (see <c>SessionExecutionExtensions.IsSessionComplete</c>). Otherwise
/// <see cref="SessionExecutionStatus.Partial"/>.
/// </para>
/// </remarks>
public class SessionExecution
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
    /// <remarks>
    /// When a document is produced by the one-time <c>--migrate-session-executions</c> migration
    /// from a source <c>WorkoutLog</c>, this is set to that <c>WorkoutLog.ExternalId</c> — NOT a
    /// freshly-generated Guid — so <c>PersonalRecord.WorkoutLogId</c> (and its idempotency index)
    /// continue to resolve without any PersonalRecord data migration.
    /// </remarks>
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <summary>
    /// The client this execution belongs to (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// Reference to the training plan's ExternalId. Null for ad-hoc (unplanned) workouts.
    /// </summary>
    [BsonElement("planId")]
    [BsonIgnoreIfNull]
    public Guid? PlanId { get; set; }

    /// <summary>
    /// Reference to the TrainingSession's SessionId within the plan. Null for ad-hoc workouts.
    /// </summary>
    [BsonElement("sessionId")]
    [BsonIgnoreIfNull]
    public Guid? SessionId { get; set; }

    /// <summary>
    /// The calendar day (midnight UTC) this execution applies to. Derived via
    /// <see cref="ToCompletionDateUtc"/> from the workout's start/completion instant (live path)
    /// or supplied directly (checkbox path).
    /// </summary>
    [BsonElement("date")]
    public DateTime Date { get; set; }

    /// <summary>
    /// Lifecycle status — see remarks on <see cref="SessionExecution"/>.
    /// </summary>
    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public SessionExecutionStatus Status { get; set; } = SessionExecutionStatus.Partial;

    /// <summary>
    /// List of exercise external IDs that have been marked complete for this session on this date.
    /// <para>
    /// <b>Deprecated.</b> New writes populate <see cref="CompletedExerciseIdsBySection"/> instead.
    /// This flat list is kept for back-compat reads of historical data; it is mirrored from the new
    /// dict so that legacy readers continue to work.
    /// </para>
    /// </summary>
    [BsonElement("completedExerciseIds")]
    public List<Guid> CompletedExerciseIds { get; set; } = [];

    /// <summary>
    /// Per-section completed exercise IDs. Key = <see cref="TrainingWorkout.SectionId"/> serialized
    /// as a lowercase string, value = list of <see cref="SessionExercise.ExerciseExternalId"/>
    /// values completed within that specific section instance.
    /// </summary>
    [BsonElement("completedExerciseIdsBySection")]
    [BsonIgnoreIfNull]
    public Dictionary<string, List<Guid>>? CompletedExerciseIdsBySection { get; set; }

    /// <summary>
    /// Workout IDs (matching <see cref="TrainingWorkout.WorkoutId"/>) that the client has marked
    /// complete on this date. Used for workouts that don't track at the exercise level.
    /// </summary>
    [BsonElement("completedWorkoutIds")]
    [BsonIgnoreIfNull]
    public List<Guid>? CompletedWorkoutIds { get; set; }

    /// <summary>
    /// Optional per-set completion data, keyed by exerciseExternalId.
    /// Each entry is the set of 1-based set numbers that were completed.
    /// </summary>
    [BsonElement("completedSets")]
    [BsonIgnoreIfNull]
    public Dictionary<string, List<int>>? CompletedSets { get; set; }

    /// <summary>
    /// Optional detailed set-by-set performance data. Present only when the client ran the
    /// live-training-assistant flow, or a trainer retroactively finished the session.
    /// Null for executions created purely via the lightweight Today-card checkboxes.
    /// </summary>
    [BsonElement("performance")]
    [BsonIgnoreIfNull]
    public SessionExecutionPerformance? Performance { get; set; }

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

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;

    /// <summary>
    /// Flat view of all exercises across all Performance sections. Read-only convenience
    /// accessor mirroring the retired <c>WorkoutLog.Exercises</c> property. Empty when
    /// <see cref="Performance"/> is null.
    /// </summary>
    [BsonIgnore]
    public IReadOnlyList<WorkoutExercise> Exercises =>
        Performance?.Exercises ?? [];

    /// <summary>
    /// Converts a UTC instant to the midnight-UTC calendar-day value used as <see cref="Date"/>.
    /// Single authoritative expression — mirrors the retired <c>WorkoutLog.ToCompletionDateUtc</c>
    /// so historical data derived from it agrees on the calendar day for backdated finishes.
    /// </summary>
    /// <param name="instantUtc">The UTC instant to convert.</param>
    /// <returns>The corresponding midnight UTC <see cref="DateTime"/>.</returns>
    public static DateTime ToCompletionDateUtc(DateTime instantUtc) =>
        DateOnly.FromDateTime(instantUtc).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
}
