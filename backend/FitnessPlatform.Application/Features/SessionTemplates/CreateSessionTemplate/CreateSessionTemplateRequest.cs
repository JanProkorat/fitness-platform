using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.SessionTemplates.CreateSessionTemplate;

/// <summary>
/// Request model for creating a new session template.
/// </summary>
public class CreateSessionTemplateRequest
{
    /// <summary>
    /// Display name of the template.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Localized template names (en, cs, de), when available.
    /// </summary>
    public LocalizedNames? LocalizedNames { get; set; }

    /// <summary>
    /// Optional description of the template.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Difficulty level of the template.
    /// </summary>
    public ExerciseDifficulty Difficulty { get; set; }

    /// <summary>
    /// Estimated total duration of the session in minutes.
    /// </summary>
    public int? EstimatedDurationMinutes { get; set; }

    /// <summary>
    /// Session-level workout format / scoring methodology.
    /// </summary>
    public WorkoutFormat Format { get; set; } = WorkoutFormat.Standard;

    /// <summary>
    /// Format configuration for the session. Must be null for Standard format.
    /// </summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Ordered workouts to include — the existing <see cref="TrainingWorkout"/> snapshot shape,
    /// verbatim, so a template copies directly into a plan session.
    /// </summary>
    public List<TrainingWorkout> Workouts { get; set; } = [];

    /// <summary>
    /// Standalone exercises to include — the existing <see cref="SessionExercise"/> snapshot
    /// shape, verbatim. Shares one ordering sequence with <see cref="Workouts"/>: a duplicate
    /// <see cref="TrainingWorkout.Order"/>/<see cref="SessionExercise.Order"/> across the two
    /// lists is rejected.
    /// </summary>
    public List<SessionExercise> StandaloneExercises { get; set; } = [];

    /// <summary>
    /// Who can read this template besides the caller. Defaults to
    /// <see cref="LibraryVisibility.Private"/> when omitted.
    /// </summary>
    public LibraryVisibility Visibility { get; set; } = LibraryVisibility.Private;
}
