using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Embedded sub-document on <see cref="SessionExecution"/> carrying the "live workout" data
/// that used to live on the standalone <c>WorkoutLog</c> document — set-by-set performance,
/// WOD results, mood/notes, and start/completion timestamps.
/// </summary>
/// <remarks>
/// Present only when the client actually ran the live-training-assistant flow (StartWorkout →
/// UpdateWorkout → CompleteWorkout) or a trainer retroactively finished the session via
/// <c>FinishSessionEndpoint</c>. A <see cref="SessionExecution"/> created purely via the
/// lightweight Today-card checkboxes (Mark*Complete) has <c>Performance == null</c>.
/// Reuses <see cref="LoggedWorkout"/>/<see cref="WorkoutExercise"/>/<see cref="WorkoutSet"/>/
/// <see cref="Documents.WodResult"/> UNCHANGED so <c>SessionExecutionDto</c> (the
/// GetTrainingPlan wire contract) stays byte-stable.
/// </remarks>
public class SessionExecutionPerformance
{
    /// <summary>
    /// When the workout was started.
    /// </summary>
    [BsonElement("startedAt")]
    public DateTime StartedAt { get; set; }

    /// <summary>
    /// When the workout was completed. Null if still in progress (draft).
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
    /// WOD format result for the whole session (e.g. ForTime total, AMRAP round count).
    /// Null for Standard workouts or when not yet recorded.
    /// </summary>
    [BsonElement("wodResult")]
    [BsonIgnoreIfNull]
    public WodResult? WodResult { get; set; }

    /// <summary>
    /// Workouts in this session execution. Each workout contains logged exercises/sets.
    /// </summary>
    [BsonElement("workouts")]
    public List<LoggedWorkout> Workouts { get; set; } = [];

    /// <summary>
    /// Flat view of all exercises across all workouts. Read-only convenience accessor.
    /// Not stored in MongoDB — computed from <see cref="Workouts"/>.
    /// </summary>
    [BsonIgnore]
    public IReadOnlyList<WorkoutExercise> Exercises =>
        Workouts.SelectMany(w => w.Exercises).ToList();
}
