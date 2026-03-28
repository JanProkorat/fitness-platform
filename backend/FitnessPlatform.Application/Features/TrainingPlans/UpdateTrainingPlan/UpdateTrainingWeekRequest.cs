using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

/// <summary>
/// Represents a single week submitted in a full-state training plan update.
/// </summary>
public class UpdateTrainingWeekRequest
{
    /// <summary>
    /// Week number within the plan (1-based).
    /// </summary>
    public int WeekNumber { get; set; }

    /// <summary>
    /// Sessions in this week.
    /// </summary>
    public List<UpdateSessionRequest> Sessions { get; set; } = [];

    /// <summary>
    /// Optional day-level notes keyed by day of week (1 = Monday … 7 = Sunday).
    /// </summary>
    public Dictionary<int, string>? DayNotes { get; set; }
}

/// <summary>
/// Represents a training session submitted in a full-state plan update.
/// </summary>
public class UpdateSessionRequest
{
    /// <summary>
    /// Optional existing session identifier. New GUID generated if null.
    /// </summary>
    public Guid? SessionId { get; set; }

    /// <summary>
    /// Day of week (1 = Monday … 7 = Sunday).
    /// </summary>
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Display name (e.g. "Push Day").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Display order within the day (1-based).
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Optional coach notes.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Exercises in this session.
    /// </summary>
    public List<UpdateSessionExerciseRequest> Exercises { get; set; } = [];
}

/// <summary>
/// Represents an exercise entry in a training session update.
/// </summary>
public class UpdateSessionExerciseRequest
{
    /// <summary>
    /// External (public) identifier of the exercise.
    /// </summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>
    /// Display name of the exercise (snapshot at time of planning).
    /// </summary>
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>
    /// Display order within the session (1-based).
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Optional coach notes for this exercise.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Rest time between sets in seconds.
    /// </summary>
    public int? RestSeconds { get; set; }

    /// <summary>
    /// Planned sets for this exercise.
    /// </summary>
    public List<UpdateExerciseSetRequest> Sets { get; set; } = [];
}

/// <summary>
/// Represents a single set in an exercise update.
/// </summary>
public class UpdateExerciseSetRequest
{
    /// <summary>
    /// Set number within the exercise (1-based).
    /// </summary>
    public int SetNumber { get; set; }

    /// <summary>
    /// Type of set.
    /// </summary>
    public SetType Type { get; set; } = SetType.Normal;

    /// <summary>
    /// Target number of repetitions.
    /// </summary>
    public int? Reps { get; set; }

    /// <summary>
    /// Target weight in kilograms.
    /// </summary>
    public decimal? WeightKg { get; set; }

    /// <summary>
    /// Target duration in seconds.
    /// </summary>
    public int? DurationSeconds { get; set; }

    /// <summary>
    /// Target RPE (1-10).
    /// </summary>
    public decimal? Rpe { get; set; }

    /// <summary>
    /// Target distance in meters.
    /// </summary>
    public decimal? DistanceMeters { get; set; }

    /// <summary>
    /// Rest time after this set in seconds.
    /// </summary>
    public int? RestSeconds { get; set; }
}
