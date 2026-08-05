using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

/// <summary>
/// Full training-plan-template detail including all weeks, days, sessions, workouts, and
/// exercises. Used by the detail <c>GET</c> and by <c>PUT</c>'s response.
/// </summary>
public class TrainingPlanTemplateDetailDto
{
    /// <summary>
    /// Template's public identifier.
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// Display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional free-text description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Primary fitness goal this template targets.
    /// </summary>
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Difficulty level this template targets.
    /// </summary>
    public ExerciseDifficulty? Difficulty { get; set; }

    /// <summary>
    /// All weeks in the template with their days, sessions, workouts, and exercises.
    /// </summary>
    public List<TrainingTemplateWeek> Weeks { get; set; } = [];

    /// <summary>
    /// Number of weeks, server-computed from <see cref="Weeks"/>.
    /// </summary>
    public int WeekCount { get; set; }

    /// <summary>
    /// Who can read this entry besides its owner.
    /// </summary>
    public LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// True when the authenticated caller is the trainer who owns this template.
    /// </summary>
    public bool IsOwnedByCurrentUser { get; set; }

    /// <summary>
    /// Optimistic concurrency version.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// When the template was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When the template was last updated.
    /// </summary>
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Maps a <see cref="TrainingPlanTemplate"/> document to a detailed response DTO.
    /// </summary>
    /// <param name="template">The training plan template document.</param>
    /// <param name="currentUserId">Id of the authenticated caller.</param>
    public static TrainingPlanTemplateDetailDto FromDocument(TrainingPlanTemplate template, Guid currentUserId) => new()
    {
        TemplateId = template.ExternalId,
        Name = template.Name,
        Description = template.Description,
        Goal = template.Goal,
        Difficulty = template.Difficulty,
        Weeks = template.Weeks,
        WeekCount = template.WeekCount,
        Visibility = template.Visibility,
        IsOwnedByCurrentUser = template.OwnerId == currentUserId,
        Version = template.Version,
        DateCreated = template.DateCreated,
        DateUpdated = template.DateUpdated
    };
}
