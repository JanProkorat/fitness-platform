using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.WorkoutLogs.UpdateWorkout;

/// <summary>
/// Request to progressively update a workout log with exercise data.
/// Designed for offline-first: client sends all exercises/sets accumulated so far.
/// </summary>
public class UpdateWorkoutRequest
{
    /// <summary>
    /// The workout log's public identifier.
    /// </summary>
    public Guid LogId { get; set; }

    /// <summary>
    /// Client's subjective mood rating (1-5).
    /// </summary>
    public int? Mood { get; set; }

    /// <summary>
    /// Optional client notes.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Current state of exercises performed.
    /// </summary>
    public List<UpdateWorkoutExerciseRequest> Exercises { get; set; } = [];
}

/// <summary>
/// Exercise data in a workout update.
/// </summary>
public class UpdateWorkoutExerciseRequest
{
    /// <summary>
    /// Reference to the exercise document's ExternalId.
    /// </summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>
    /// Snapshot of the exercise name.
    /// </summary>
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>
    /// Sets performed for this exercise.
    /// </summary>
    public List<UpdateWorkoutSetRequest> Sets { get; set; } = [];
}

/// <summary>
/// Set data in a workout update.
/// </summary>
public class UpdateWorkoutSetRequest
{
    /// <summary>
    /// Set number (1-based).
    /// </summary>
    public int SetNumber { get; set; }

    /// <summary>
    /// Actual reps completed.
    /// </summary>
    public int? Reps { get; set; }

    /// <summary>
    /// Actual weight in kg.
    /// </summary>
    public decimal? WeightKg { get; set; }

    /// <summary>
    /// Rate of Perceived Exertion (1-10).
    /// </summary>
    public decimal? Rpe { get; set; }

    /// <summary>
    /// Duration in seconds.
    /// </summary>
    public int? DurationSeconds { get; set; }

    /// <summary>
    /// Distance in meters.
    /// </summary>
    public decimal? DistanceMeters { get; set; }

    /// <summary>
    /// When this set was completed.
    /// </summary>
    public DateTime? CompletedAt { get; set; }
}
