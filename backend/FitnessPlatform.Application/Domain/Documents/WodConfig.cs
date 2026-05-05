using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Configuration parameters for a WOD (Workout Of the Day) format.
/// Which fields are meaningful depends on the <see cref="FitnessPlatform.Application.Domain.Enums.WorkoutFormat"/>.
/// All fields are nullable — only those relevant to the chosen format are expected to be set.
/// </summary>
public class WodConfig
{
    /// <summary>
    /// Maximum allowed time in seconds (used by ForTime and AMRAP).
    /// </summary>
    [BsonElement("timeCapSeconds")]
    [BsonIgnoreIfNull]
    public int? TimeCapSeconds { get; set; }

    /// <summary>
    /// Duration of each interval in seconds (used by EMOM).
    /// </summary>
    [BsonElement("intervalSeconds")]
    [BsonIgnoreIfNull]
    public int? IntervalSeconds { get; set; }

    /// <summary>
    /// Total number of rounds (used by EMOM and Tabata).
    /// </summary>
    [BsonElement("totalRounds")]
    [BsonIgnoreIfNull]
    public int? TotalRounds { get; set; }

    /// <summary>
    /// Work interval duration in seconds (used by Tabata).
    /// </summary>
    [BsonElement("workSeconds")]
    [BsonIgnoreIfNull]
    public int? WorkSeconds { get; set; }

    /// <summary>
    /// Rest interval duration in seconds (used by Tabata).
    /// </summary>
    [BsonElement("restSeconds")]
    [BsonIgnoreIfNull]
    public int? RestSeconds { get; set; }
}
