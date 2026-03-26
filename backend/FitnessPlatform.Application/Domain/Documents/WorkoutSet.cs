using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single set actually performed during a workout with recorded values.
/// </summary>
public class WorkoutSet
{
    /// <summary>
    /// Set number within the exercise (1-based).
    /// </summary>
    [BsonElement("setNumber")]
    public int SetNumber { get; set; }

    /// <summary>
    /// Actual repetitions completed.
    /// </summary>
    [BsonElement("reps")]
    [BsonIgnoreIfNull]
    public int? Reps { get; set; }

    /// <summary>
    /// Actual weight used in kilograms.
    /// </summary>
    [BsonElement("weightKg")]
    [BsonIgnoreIfNull]
    public decimal? WeightKg { get; set; }

    /// <summary>
    /// Rate of Perceived Exertion (1-10 scale).
    /// </summary>
    [BsonElement("rpe")]
    [BsonIgnoreIfNull]
    public decimal? Rpe { get; set; }

    /// <summary>
    /// Actual duration in seconds (for timed exercises).
    /// </summary>
    [BsonElement("durationSeconds")]
    [BsonIgnoreIfNull]
    public int? DurationSeconds { get; set; }

    /// <summary>
    /// Actual distance in meters (for distance-based exercises).
    /// </summary>
    [BsonElement("distanceMeters")]
    [BsonIgnoreIfNull]
    public decimal? DistanceMeters { get; set; }

    /// <summary>
    /// When this set was completed.
    /// </summary>
    [BsonElement("completedAt")]
    [BsonIgnoreIfNull]
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Whether this set is a personal record for this exercise.
    /// </summary>
    [BsonElement("isPR")]
    public bool IsPR { get; set; }
}
