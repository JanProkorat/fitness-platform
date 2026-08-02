using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single training session within a week (e.g. "Push Day", "Leg Day").
/// </summary>
public class TrainingSession
{
    /// <summary>
    /// Unique identifier for this session within the plan.
    /// </summary>
    [BsonElement("sessionId")]
    public Guid SessionId { get; set; }

    /// <summary>
    /// Day of the week (1 = Monday, 7 = Sunday).
    /// </summary>
    [BsonElement("dayOfWeek")]
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Display name (e.g. "Push Day", "Upper Body").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Display order within the day (1-based).
    /// </summary>
    [BsonElement("order")]
    public int Order { get; set; }

    /// <summary>
    /// Optional coach notes for this session.
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Session-level workout format. Kept nullable for one release as an inheritable default —
    /// workouts inherit when their own Format is null. Null means Standard.
    /// </summary>
    [BsonElement("format")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// Session-level format configuration. Null when Format is null or Standard.
    /// </summary>
    [BsonElement("formatConfig")]
    [BsonIgnoreIfNull]
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Workouts in this session. Each workout contains its own exercises.
    /// The legacy flat <c>exercises</c> field (pre-workouts documents) was retired by the
    /// one-time boot migration in <c>MongoIndexInitializer</c> (#837) — every document now
    /// carries this field populated, so no read-time backfill is required or performed.
    /// </summary>
    [BsonElement("workouts")]
    public List<TrainingWorkout> Workouts { get; set; } = [];

    /// <summary>
    /// Flat view of all exercises across all workouts. Read-only convenience accessor.
    /// Not stored in MongoDB — computed from <see cref="Workouts"/>.
    /// </summary>
    [BsonIgnore]
    public IReadOnlyList<SessionExercise> Exercises =>
        Workouts.SelectMany(w => w.Exercises).ToList();
}
