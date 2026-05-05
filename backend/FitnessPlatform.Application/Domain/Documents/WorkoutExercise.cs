using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// An exercise performed during a workout — denormalized snapshot with actual results.
/// </summary>
public class WorkoutExercise
{
    /// <summary>
    /// Reference to the exercise document's ExternalId.
    /// </summary>
    [BsonElement("exerciseExternalId")]
    public Guid ExerciseExternalId { get; set; }

    /// <summary>
    /// Snapshot of the exercise name.
    /// </summary>
    [BsonElement("exerciseName")]
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>
    /// WOD format result for this individual exercise.
    /// Null for Standard exercises or when not yet recorded.
    /// </summary>
    [BsonElement("wodResult")]
    [BsonIgnoreIfNull]
    public WodResult? WodResult { get; set; }

    /// <summary>
    /// Actual sets performed.
    /// </summary>
    [BsonElement("sets")]
    public List<WorkoutSet> Sets { get; set; } = [];
}
