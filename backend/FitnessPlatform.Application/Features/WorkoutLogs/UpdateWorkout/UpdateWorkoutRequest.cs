using FitnessPlatform.Application.Domain.Documents;

// Note: WodResult is the domain document type — used directly as DTO here
// because it is a pure data carrier with no behavioural logic.

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
    /// WOD format result for the whole session (ForTime, AMRAP, etc.).
    /// Null for Standard workouts or when not yet recorded.
    /// </summary>
    public WodResult? WodResult { get; set; }

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
    /// The section this exercise belongs to — must match <see cref="WorkoutSection.SectionId"/>
    /// (and by design the source <see cref="TrainingSection.SectionId"/>).
    /// Null for requests from legacy clients that do not yet send section context;
    /// in that case the exercise is stored in the first section of the log (single-section fallback).
    /// </summary>
    public Guid? SectionId { get; set; }

    /// <summary>
    /// Reference to the exercise document's ExternalId.
    /// </summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>
    /// Snapshot of the exercise name.
    /// </summary>
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>
    /// WOD format result for this individual exercise.
    /// Null for Standard exercises or when not yet recorded.
    /// </summary>
    public WodResult? WodResult { get; set; }

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

    // ── Snapshot-planned fields ─────────────────────────────────────────────────
    // Clients send these once from the plan prescription when first logging a set;
    // they are frozen as a snapshot onto WorkoutSet and must not change on subsequent calls.
    // All are nullable for backward compatibility with clients that do not yet send them.

    /// <summary>
    /// Prescribed repetitions from the plan prescription.
    /// </summary>
    public int? PlannedReps { get; set; }

    /// <summary>
    /// Prescribed weight (kg) from the plan prescription.
    /// </summary>
    public decimal? PlannedWeightKg { get; set; }

    /// <summary>
    /// Prescribed RPE from the plan prescription.
    /// </summary>
    public decimal? PlannedRpe { get; set; }

    /// <summary>
    /// Prescribed duration (seconds) from the plan prescription.
    /// </summary>
    public int? PlannedDurationSeconds { get; set; }

    /// <summary>
    /// Prescribed distance (meters) from the plan prescription.
    /// </summary>
    public decimal? PlannedDistanceMeters { get; set; }
}
