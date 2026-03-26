using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single set within an exercise — represents planned (prescription) values.
/// </summary>
public class ExerciseSet
{
    /// <summary>
    /// Set number within the exercise (1-based).
    /// </summary>
    [BsonElement("setNumber")]
    public int SetNumber { get; set; }

    /// <summary>
    /// Type of set (Normal, Warmup, Dropset, Superset).
    /// </summary>
    [BsonElement("type")]
    [BsonRepresentation(BsonType.String)]
    public SetType Type { get; set; } = SetType.Normal;

    /// <summary>
    /// Target number of repetitions.
    /// </summary>
    [BsonElement("reps")]
    [BsonIgnoreIfNull]
    public int? Reps { get; set; }

    /// <summary>
    /// Target weight in kilograms.
    /// </summary>
    [BsonElement("weightKg")]
    [BsonIgnoreIfNull]
    public decimal? WeightKg { get; set; }

    /// <summary>
    /// Target duration in seconds (for timed exercises).
    /// </summary>
    [BsonElement("durationSeconds")]
    [BsonIgnoreIfNull]
    public int? DurationSeconds { get; set; }

    /// <summary>
    /// Target Rate of Perceived Exertion (1-10 scale).
    /// </summary>
    [BsonElement("rpe")]
    [BsonIgnoreIfNull]
    public decimal? Rpe { get; set; }

    /// <summary>
    /// Target distance in meters (for distance-based exercises).
    /// </summary>
    [BsonElement("distanceMeters")]
    [BsonIgnoreIfNull]
    public decimal? DistanceMeters { get; set; }
}
