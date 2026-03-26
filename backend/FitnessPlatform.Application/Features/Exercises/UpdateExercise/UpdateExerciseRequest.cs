using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Exercises.UpdateExercise;

/// <summary>
/// Request model for updating a custom exercise.
/// </summary>
public class UpdateExerciseRequest
{
    /// <summary>
    /// The public identifier of the exercise to update.
    /// </summary>
    public Guid ExerciseId { get; set; }

    /// <summary>
    /// Canonical name of the exercise.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional English name.
    /// </summary>
    public string? NameEn { get; set; }

    /// <summary>
    /// Optional Czech name.
    /// </summary>
    public string? NameCs { get; set; }

    /// <summary>
    /// Optional German name.
    /// </summary>
    public string? NameDe { get; set; }

    /// <summary>
    /// Optional description of the exercise.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Target muscle groups. First element is the primary muscle group.
    /// </summary>
    public List<MuscleGroup> MuscleGroups { get; set; } = [];

    /// <summary>
    /// Equipment required for the exercise.
    /// </summary>
    public ExerciseEquipment Equipment { get; set; }

    /// <summary>
    /// Category of the exercise.
    /// </summary>
    public ExerciseCategory Category { get; set; }

    /// <summary>
    /// Difficulty level of the exercise.
    /// </summary>
    public ExerciseDifficulty Difficulty { get; set; }

    /// <summary>
    /// Technique notes in Markdown format.
    /// </summary>
    public string? TechniqueNotes { get; set; }
}
