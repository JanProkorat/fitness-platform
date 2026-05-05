using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Records the outcome of a WOD (Workout Of the Day) format session or exercise.
/// Which fields are meaningful depends on the <see cref="FitnessPlatform.Application.Domain.Enums.WorkoutFormat"/>.
/// All fields are nullable — only those relevant to the actual result need to be set.
/// </summary>
public class WodResult
{
    /// <summary>
    /// Number of complete rounds completed (AMRAP, Tabata).
    /// </summary>
    [BsonElement("roundsCompleted")]
    [BsonIgnoreIfNull]
    public int? RoundsCompleted { get; set; }

    /// <summary>
    /// Extra reps accumulated after the last complete round (AMRAP).
    /// </summary>
    [BsonElement("extraReps")]
    [BsonIgnoreIfNull]
    public int? ExtraReps { get; set; }

    /// <summary>
    /// Total time taken to complete the workout in seconds (ForTime).
    /// </summary>
    [BsonElement("totalTimeSeconds")]
    [BsonIgnoreIfNull]
    public int? TotalTimeSeconds { get; set; }

    /// <summary>
    /// List of round numbers that were not completed (Tabata, EMOM).
    /// </summary>
    [BsonElement("failedRounds")]
    [BsonIgnoreIfNull]
    public List<int>? FailedRounds { get; set; }

    /// <summary>
    /// Reps completed per round, indexed 1-based (Tabata, EMOM, AMRAP).
    /// </summary>
    [BsonElement("repsByRound")]
    [BsonIgnoreIfNull]
    public List<int>? RepsByRound { get; set; }
}
