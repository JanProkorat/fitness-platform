using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.SessionTemplates.Shared;

/// <summary>
/// Lightweight session template summary for search/list views.
/// </summary>
public class SessionTemplateSummaryDto
{
    /// <summary>
    /// Public identifier of the session template.
    /// </summary>
    public Guid TemplateId { get; set; }

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
    public WorkoutFormat Format { get; set; }

    /// <summary>
    /// Number of workouts in this template.
    /// </summary>
    public int WorkoutCount { get; set; }

    /// <summary>
    /// Number of standalone exercises (not grouped under any workout) in this template.
    /// </summary>
    public int StandaloneExerciseCount { get; set; }

    /// <summary>
    /// Who can read this template besides its owner.
    /// </summary>
    public LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// True when the authenticated caller is the trainer who owns this template.
    /// </summary>
    public bool IsOwnedByCurrentUser { get; set; }

    /// <summary>
    /// When the template was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// Maps a <see cref="SessionTemplate"/> document to a <see cref="SessionTemplateSummaryDto"/>.
    /// </summary>
    /// <param name="template">The source session template document.</param>
    /// <param name="currentUserId">Id of the authenticated caller.</param>
    /// <returns>A summary DTO.</returns>
    public static SessionTemplateSummaryDto FromDocument(SessionTemplate template, Guid currentUserId) => new()
    {
        TemplateId = template.ExternalId,
        Name = template.Name,
        LocalizedNames = template.LocalizedNames,
        Description = template.Description,
        Difficulty = template.Difficulty,
        EstimatedDurationMinutes = template.EstimatedDurationMinutes,
        Format = template.Format,
        WorkoutCount = template.Workouts.Count,
        StandaloneExerciseCount = template.StandaloneExercises.Count,
        Visibility = template.Visibility,
        IsOwnedByCurrentUser = template.OwnerId == currentUserId,
        DateCreated = template.DateCreated
    };
}
