using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

/// <summary>
/// Represents a single week submitted when creating or fully replacing a training plan template.
/// </summary>
public class TemplateWeekRequest
{
    /// <summary>
    /// Week number within the template (1-based).
    /// </summary>
    public int WeekNumber { get; set; }

    /// <summary>
    /// Days in this week.
    /// </summary>
    public List<TemplateDayRequest> Days { get; set; } = [];
}

/// <summary>
/// Represents a single day within a template week.
/// </summary>
public class TemplateDayRequest
{
    /// <summary>
    /// Day of week (1 = Monday … 7 = Sunday).
    /// </summary>
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Optional coach note for this day.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Training sessions scheduled for this day.
    /// </summary>
    public List<TemplateSessionRequest> Sessions { get; set; } = [];
}

/// <summary>
/// Represents a training session submitted in a template create/update request.
/// </summary>
public class TemplateSessionRequest
{
    /// <summary>
    /// Optional existing session identifier. New GUID generated if null or empty.
    /// </summary>
    public Guid? SessionId { get; set; }

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
    /// Session-level workout format. Null means no format override at session level.
    /// Workouts inherit this when their own Format is null.
    /// </summary>
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// Session-level format configuration. Null when Format is null or Standard.
    /// </summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Ordered workouts in this session. Each workout contains its own exercises.
    /// </summary>
    public List<TemplateWorkoutRequest> Workouts { get; set; } = [];

    /// <summary>
    /// Standalone exercises directly on this session — not grouped under any workout.
    /// Shares one ordering sequence with <see cref="Workouts"/>.
    /// </summary>
    public List<TemplateSessionExerciseRequest> StandaloneExercises { get; set; } = [];
}

/// <summary>
/// Represents a training workout submitted in a template session request.
/// </summary>
public class TemplateWorkoutRequest
{
    /// <summary>
    /// Optional existing workout identifier. New GUID generated if null or empty.
    /// </summary>
    public Guid? WorkoutId { get; set; }

    /// <summary>
    /// Display order within the session (0-based).
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Display name of the workout (e.g. "Hlavní", "Warm-up").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Workout format for this workout. Null means workout inherits the session-level format.
    /// </summary>
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// Format configuration. Required for non-Standard, non-null workout formats; must be null
    /// for Standard.
    /// </summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Optional coach note for this workout.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Exercises in this workout.
    /// </summary>
    public List<TemplateSessionExerciseRequest> Exercises { get; set; } = [];
}

/// <summary>
/// Represents an exercise entry in a template workout or a session's standalone exercise list.
/// </summary>
public class TemplateSessionExerciseRequest
{
    /// <summary>
    /// Optional existing instance identifier for this exercise entry. New GUID generated if
    /// null or empty.
    /// </summary>
    public Guid? ExerciseId { get; set; }

    /// <summary>
    /// External (public) identifier of the exercise.
    /// </summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>
    /// Display name of the exercise (snapshot at time of planning).
    /// </summary>
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>
    /// Display order within the workout (1-based).
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
    /// How performance for this exercise is measured. Defaults to Reps.
    /// </summary>
    public MovementType MovementType { get; set; } = MovementType.Reps;

    /// <summary>
    /// Per-exercise format override. Null means the exercise inherits the workout's format.
    /// </summary>
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// Per-exercise format configuration. Null when Format is null or Standard.
    /// </summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Planned sets for this exercise.
    /// </summary>
    public List<TemplateExerciseSetRequest> Sets { get; set; } = [];
}

/// <summary>
/// Represents a single set in a template exercise request.
/// </summary>
public class TemplateExerciseSetRequest
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
