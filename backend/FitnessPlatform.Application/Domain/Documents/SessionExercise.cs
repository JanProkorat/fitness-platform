using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// An exercise within a training session — denormalized snapshot of exercise data.
/// </summary>
public class SessionExercise
{
    /// <summary>
    /// Reference to the original exercise document's ExternalId.
    /// </summary>
    [BsonElement("exerciseExternalId")]
    public Guid ExerciseExternalId { get; set; }

    /// <summary>
    /// Snapshot of the exercise name at time of addition.
    /// </summary>
    [BsonElement("exerciseName")]
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>
    /// Display order within the session (1-based).
    /// </summary>
    [BsonElement("order")]
    public int Order { get; set; }

    /// <summary>
    /// Optional coach notes for this exercise.
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Rest time between sets in seconds.
    /// </summary>
    [BsonElement("restSeconds")]
    [BsonIgnoreIfNull]
    public int? RestSeconds { get; set; }

    /// <summary>
    /// How performance for this exercise is measured. Defaults to Reps.
    /// </summary>
    [BsonElement("movementType")]
    [BsonRepresentation(BsonType.String)]
    public MovementType MovementType { get; set; } = MovementType.Reps;

    /// <summary>
    /// Per-exercise format override. Null means the exercise inherits the session's format.
    /// </summary>
    [BsonElement("format")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// Per-exercise format configuration. Null when Format is null or Standard.
    /// </summary>
    [BsonElement("formatConfig")]
    [BsonIgnoreIfNull]
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Planned sets for this exercise.
    /// </summary>
    [BsonElement("sets")]
    public List<ExerciseSet> Sets { get; set; } = [];
}
