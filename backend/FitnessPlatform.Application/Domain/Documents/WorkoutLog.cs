using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document recording a client's completed workout session.
/// </summary>
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
    /// Sections in this workout. Each section contains completed exercises.
    /// Schema-on-read: if a stored document has only flat <c>exercises</c> and no <c>sections</c>,
    /// a single default section named "Hlavní" is synthesized via <see cref="WithBackfilledSections"/>.
    /// </summary>
    [BsonElement("sections")]
    public List<WorkoutSection> Sections { get; set; } = [];

    /// <summary>
    /// Legacy flat exercises list. Only present in documents written before the sections migration.
    /// Not written on new saves. Used by <see cref="WithBackfilledSections"/> for schema-on-read.
    /// </summary>
    [BsonElement("exercises")]
    [BsonIgnoreIfNull]
    public List<WorkoutExercise>? LegacyExercises { get; set; }

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
    /// Returns a view of this log with legacy flat-exercise documents backfilled into a default section.
    /// If <see cref="Sections"/> is already populated this is a no-op.
    /// </summary>
    public WorkoutLog WithBackfilledSections()
    {
        if (Sections.Count > 0 || LegacyExercises is null || LegacyExercises.Count == 0)
            return this;

        Sections =
        [
            new WorkoutSection
            {
                SectionId = Guid.NewGuid(),
                Order = 0,
                Name = "Hlavní",
                Format = null,
                WodResult = WodResult,
                Exercises = LegacyExercises
            }
        ];
        LegacyExercises = null;
        return this;
    }

    /// <summary>
    /// Flat view of all exercises across all sections. Read-only convenience accessor.
    /// Not stored in MongoDB — computed from <see cref="Sections"/>.
    /// </summary>
    [BsonIgnore]
    public IReadOnlyList<WorkoutExercise> Exercises =>
        Sections.SelectMany(s => s.Exercises).ToList();
}
