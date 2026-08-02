using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.CreateWorkoutTemplate;

/// <summary>
/// Request for creating a new section template.
/// </summary>
public class CreateWorkoutTemplateRequest
{
    /// <summary>Display name of the template.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional coach notes describing the workout as a whole.</summary>
    public string? Notes { get; set; }

    /// <summary>Default workout format. Null means no format override (Standard / inherits from session).</summary>
    public WorkoutFormat? DefaultFormat { get; set; }

    /// <summary>Default format configuration. Null when DefaultFormat is null or Standard.</summary>
    public WodConfig? DefaultFormatConfig { get; set; }

    /// <summary>Default exercises to pre-populate when applying this template.</summary>
    public List<CreateWorkoutTemplateExerciseRequest> DefaultExercises { get; set; } = [];
}

/// <summary>
/// An exercise entry in a section template.
/// </summary>
public class CreateWorkoutTemplateExerciseRequest
{
    /// <summary>External (public) identifier of the exercise.</summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>Display name of the exercise (snapshot).</summary>
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>Display order within the section (1-based).</summary>
    public int Order { get; set; }

    /// <summary>Optional coach notes for this exercise.</summary>
    public string? Notes { get; set; }

    /// <summary>Rest time between sets in seconds.</summary>
    public int? RestSeconds { get; set; }

    /// <summary>How performance for this exercise is measured. Defaults to Reps.</summary>
    public MovementType MovementType { get; set; } = MovementType.Reps;

    /// <summary>Per-exercise format override. Null means inherits the section's format.</summary>
    public WorkoutFormat? Format { get; set; }

    /// <summary>Per-exercise format configuration. Null when Format is null or Standard.</summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>Planned sets for this exercise.</summary>
    public List<CreateWorkoutTemplateSetRequest> Sets { get; set; } = [];
}

/// <summary>
/// A planned set in a section template exercise.
/// </summary>
public class CreateWorkoutTemplateSetRequest
{
    /// <summary>Set number within the exercise (1-based).</summary>
    public int SetNumber { get; set; }

    /// <summary>Type of set.</summary>
    public SetType Type { get; set; } = SetType.Normal;

    /// <summary>Target number of repetitions.</summary>
    public int? Reps { get; set; }

    /// <summary>Target weight in kilograms.</summary>
    public decimal? WeightKg { get; set; }

    /// <summary>Target duration in seconds.</summary>
    public int? DurationSeconds { get; set; }

    /// <summary>Target RPE (1-10).</summary>
    public decimal? Rpe { get; set; }

    /// <summary>Target distance in meters.</summary>
    public decimal? DistanceMeters { get; set; }

    /// <summary>Rest time after this set in seconds.</summary>
    public int? RestSeconds { get; set; }
}
