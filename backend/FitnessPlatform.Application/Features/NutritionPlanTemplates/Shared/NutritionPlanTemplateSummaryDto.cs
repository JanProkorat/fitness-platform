using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Lightweight nutrition-plan-template summary — used for search results and as the response of
/// endpoints that create or clone a template without needing the full week tree back.
/// </summary>
public class NutritionPlanTemplateSummaryDto
{
    /// <summary>
    /// Template's public identifier.
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// The nutritionist who owns this template.
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
    /// Dietary style this template targets.
    /// </summary>
    public DietaryStyle? DietaryStyle { get; set; }

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
    /// Maps a <see cref="NutritionPlanTemplate"/> document to a summary DTO.
    /// </summary>
    /// <param name="template">The nutrition plan template document.</param>
    public static NutritionPlanTemplateSummaryDto FromDocument(NutritionPlanTemplate template) => new()
    {
        TemplateId = template.ExternalId,
        OwnerId = template.OwnerId,
        Name = template.Name,
        Description = template.Description,
        Goal = template.Goal,
        DietaryStyle = template.DietaryStyle,
        WeekCount = template.WeekCount,
        Visibility = template.Visibility,
        Version = template.Version,
        DateCreated = template.DateCreated,
        DateUpdated = template.DateUpdated
    };
}
