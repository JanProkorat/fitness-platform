using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Exercises.Shared;

/// <summary>
/// Full exercise detail DTO including video and technique information.
/// </summary>
public class ExerciseDetail
{
    /// <summary>
    /// Public-facing exercise identifier.
    /// </summary>
    public Guid ExerciseId { get; set; }

    /// <summary>
    /// Resolved exercise name for display (localized based on Accept-Language).
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Original (canonical) exercise name, unaffected by language resolution.
    /// </summary>
    public string RawName { get; set; } = string.Empty;

    /// <summary>
    /// English name, if available.
    /// </summary>
    public string? NameEn { get; set; }

    /// <summary>
    /// Czech name, if available.
    /// </summary>
    public string? NameCs { get; set; }

    /// <summary>
    /// German name, if available.
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
    /// URL to the exercise demonstration video.
    /// </summary>
    public string? VideoUrl { get; set; }

    /// <summary>
    /// URL to the video thumbnail image.
    /// </summary>
    public string? ThumbnailUrl { get; set; }

    /// <summary>
    /// Technique notes in Markdown format.
    /// </summary>
    public string? TechniqueNotes { get; set; }

    /// <summary>
    /// Whether this is a custom exercise created by a trainer.
    /// </summary>
    public bool IsCustom { get; set; }

    /// <summary>
    /// Data source: "system" or "custom".
    /// </summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>
    /// Maps an <see cref="Exercise"/> document to an <see cref="ExerciseDetail"/> DTO.
    /// </summary>
    /// <param name="exercise">The exercise document.</param>
    /// <param name="language">Two-letter language code for name resolution (e.g. "cs", "de"). Defaults to "en".</param>
    public static ExerciseDetail FromDocument(Exercise exercise, string? language = null) => new()
    {
        ExerciseId = exercise.ExternalId,
        Name = exercise.LocalizedNames?.Resolve(language) ?? exercise.Name,
        RawName = exercise.Name,
        NameEn = exercise.LocalizedNames?.En,
        NameCs = exercise.LocalizedNames?.Cs,
        NameDe = exercise.LocalizedNames?.De,
        Description = exercise.Description,
        MuscleGroups = exercise.MuscleGroups,
        Equipment = exercise.Equipment,
        Category = exercise.Category,
        Difficulty = exercise.Difficulty,
        VideoUrl = exercise.VideoUrl,
        ThumbnailUrl = exercise.ThumbnailUrl,
        TechniqueNotes = exercise.TechniqueNotes,
        IsCustom = exercise.IsCustom,
        Source = exercise.Source
    };
}
