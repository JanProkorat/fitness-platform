using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.SessionTemplates.UpdateSessionTemplate;

/// <summary>
/// Request model for updating an existing session template.
/// </summary>
public class UpdateSessionTemplateRequest
{
    /// <summary>
    /// Public identifier of the session template to update.
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// Updated display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated localized template names (en, cs, de).
    /// </summary>
    public LocalizedNames? LocalizedNames { get; set; }

    /// <summary>
    /// Updated description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Updated difficulty level.
    /// </summary>
    public ExerciseDifficulty Difficulty { get; set; }

    /// <summary>
    /// Updated estimated total duration in minutes.
    /// </summary>
    public int? EstimatedDurationMinutes { get; set; }

    /// <summary>
    /// Updated session-level workout format.
    /// </summary>
    public WorkoutFormat Format { get; set; } = WorkoutFormat.Standard;

    /// <summary>
    /// Updated format configuration. Must be null for Standard format.
    /// </summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Updated workouts — the existing <see cref="TrainingWorkout"/> snapshot shape, verbatim.
    /// </summary>
    public List<TrainingWorkout> Workouts { get; set; } = [];

    /// <summary>
    /// Updated standalone exercises — the existing <see cref="SessionExercise"/> snapshot shape,
    /// verbatim.
    /// </summary>
    public List<SessionExercise> StandaloneExercises { get; set; } = [];

    /// <summary>
    /// Updated visibility.
    /// </summary>
    public LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// The version the caller last read. Used for optimistic-concurrency CAS; a stale value
    /// returns <c>409</c>.
    /// </summary>
    public int Version { get; set; }
}
