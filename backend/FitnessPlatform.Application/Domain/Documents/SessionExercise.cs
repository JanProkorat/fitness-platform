using MongoDB.Bson.Serialization.Attributes;

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
    /// Planned sets for this exercise.
    /// </summary>
    [BsonElement("sets")]
    public List<ExerciseSet> Sets { get; set; } = [];
}
