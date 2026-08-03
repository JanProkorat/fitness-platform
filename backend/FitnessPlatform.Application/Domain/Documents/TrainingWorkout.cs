using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// An ordered workout within a training session (e.g. "Warm-up", "Hlavní", "Cool-down") —
/// a block of exercises. Embedded sub-document inside <see cref="TrainingSession.Workouts"/>.
/// </summary>
public class TrainingWorkout
{
    /// <summary>
    /// Client-side stable identifier for this workout.
    /// </summary>
    [BsonElement("workoutId")]
    public Guid WorkoutId { get; set; }

    /// <summary>
    /// Display order within the session (0-based). Shares one ordering sequence with the
    /// session's standalone <see cref="TrainingSession.StandaloneExercises"/>.
    /// </summary>
    [BsonElement("order")]
    public int Order { get; set; }

    /// <summary>
    /// Display name of the workout (e.g. "Hlavní", "Warm-up").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Workout format for this workout. Null means it inherits the session-level format.
    /// </summary>
    [BsonElement("format")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// Format configuration for this workout. Null when Format is null or Standard.
    /// </summary>
    [BsonElement("formatConfig")]
    [BsonIgnoreIfNull]
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Optional coach note for this workout.
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Exercises in this workout.
    /// </summary>
    [BsonElement("exercises")]
    public List<SessionExercise> Exercises { get; set; } = [];
}
