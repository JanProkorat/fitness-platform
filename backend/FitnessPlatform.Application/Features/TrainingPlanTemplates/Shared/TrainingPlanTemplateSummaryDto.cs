using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

/// <summary>
/// Lightweight training-plan-template summary — used for search results and as the response of
/// endpoints that create or clone a template without needing the full week tree back.
/// </summary>
public class TrainingPlanTemplateSummaryDto
{
    /// <summary>
    /// Template's public identifier.
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// The trainer who owns this template.
    /// </summary>
    public Guid OwnerId { get; set; }

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
    /// Number of weeks, server-computed from the template's week tree.
    /// </summary>
    public int WeekCount { get; set; }

    /// <summary>
    /// Who can read this entry besides its owner.
    /// </summary>
    public LibraryVisibility Visibility { get; set; }

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
    /// Maps a <see cref="TrainingPlanTemplate"/> document to a summary DTO.
    /// </summary>
    /// <param name="template">The training plan template document.</param>
    public static TrainingPlanTemplateSummaryDto FromDocument(TrainingPlanTemplate template) => new()
    {
        TemplateId = template.ExternalId,
        OwnerId = template.OwnerId,
        Name = template.Name,
        Description = template.Description,
        Goal = template.Goal,
        Difficulty = template.Difficulty,
        WeekCount = template.WeekCount,
        Visibility = template.Visibility,
        Version = template.Version,
        DateCreated = template.DateCreated,
        DateUpdated = template.DateUpdated
    };
}
