using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document recording a client's completed workout session.
/// </summary>
/// <remarks>
/// <b>Deprecated (#841).</b> Superseded by <see cref="SessionExecution"/>, which unifies this
/// document with <see cref="TrainingCompletion"/>. The <c>workoutLogs</c> collection is kept
/// read-only (no new writes) for one release as the rollback path for the
/// <c>--migrate-session-executions</c> data migration — do not add new write sites against this
/// type. Scheduled for removal in a follow-up chore once production has soaked on the merged
/// model.
/// </remarks>
public class WorkoutLog
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
    /// The client who performed the workout (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// Reference to the training plan's ExternalId.
    /// </summary>
    [BsonElement("planId")]
    [BsonIgnoreIfNull]
    public Guid? PlanId { get; set; }

    /// <summary>
    /// Reference to the TrainingSession's SessionId within the plan.
    /// </summary>
    [BsonElement("sessionId")]
    [BsonIgnoreIfNull]
    public Guid? SessionId { get; set; }

    /// <summary>
    /// When the workout was started.
    /// </summary>
    [BsonElement("startedAt")]
    public DateTime StartedAt { get; set; }

    /// <summary>
    /// When the workout was completed. Null if still in progress.
    /// </summary>
    [BsonElement("completedAt")]
    [BsonIgnoreIfNull]
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Client's subjective mood rating (1-5). Null if not provided.
    /// </summary>
    [BsonElement("mood")]
    [BsonIgnoreIfNull]
    public int? Mood { get; set; }

    /// <summary>
    /// Optional client notes about the workout.
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Whether this workout has been completed.
    /// </summary>
    [BsonElement("isCompleted")]
    public bool IsCompleted { get; set; }

    /// <summary>
    /// The calendar day (midnight UTC) on which the workout was completed.
    /// Derived from <see cref="CompletedAt"/> via
    /// <c>DateOnly.FromDateTime(completedAt).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)</c>.
    /// Null for in-progress or legacy logs that pre-date this field.
    /// Together with <see cref="PlanId"/> and <see cref="SessionId"/> it forms the key
    /// of the date-scoped partial unique index that prevents same-day duplicate completions.
    /// </summary>
    [BsonElement("completedDate")]
    [BsonIgnoreIfNull]
    public DateTime? CompletedDate { get; set; }

    /// <summary>
    /// WOD format result for the whole session (e.g. ForTime total, AMRAP round count).
    /// Null for Standard workouts or when not yet recorded.
    /// </summary>
    [BsonElement("wodResult")]
    [BsonIgnoreIfNull]
    public WodResult? WodResult { get; set; }

    /// <summary>
    /// Workouts in this workout log. Each workout contains completed exercises. Every document
    /// is created directly in this shape — there is no production data predating the workouts
    /// model, so no migration or read-time backfill from a legacy flat <c>exercises</c> field
    /// exists or is needed.
    /// </summary>
    [BsonElement("workouts")]
    public List<LoggedWorkout> Workouts { get; set; } = [];

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
    /// Flat view of all exercises across all workouts. Read-only convenience accessor.
    /// Not stored in MongoDB — computed from <see cref="Workouts"/>.
    /// </summary>
    [BsonIgnore]
    public IReadOnlyList<WorkoutExercise> Exercises =>
        Workouts.SelectMany(w => w.Exercises).ToList();

    /// <summary>
    /// Converts a UTC completion instant to the midnight-UTC value used as
    /// <see cref="CompletedDate"/> and as the <c>TrainingCompletion.Date</c> key.
    ///
    /// Single authoritative expression so that the partial unique index key
    /// <c>(PlanId, SessionId, CompletedDate)</c> and the TrainingCompletion date key
    /// always agree on the calendar day for backdated finishes.
    ///
    /// All production write sites (WorkoutCompletionService, MongoIndexInitializer
    /// backfill) and the QA seed must call this method — never inline the expression.
    /// </summary>
    /// <param name="completedAtUtc">The UTC instant at which the workout was completed.</param>
    /// <returns>The corresponding midnight UTC <see cref="DateTime"/>.</returns>
    public static DateTime ToCompletionDateUtc(DateTime completedAtUtc) =>
        DateOnly.FromDateTime(completedAtUtc).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
}
