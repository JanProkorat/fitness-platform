using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// A single supplement entry in a nutrition-plan-template response DTO.
/// </summary>
public class TemplateSupplementDto
{
    /// <summary>Stable public identifier for the supplement.</summary>
    public Guid ExternalId { get; set; }

    /// <summary>Name of the supplement.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional dosage instruction.</summary>
    public string? Dose { get; set; }

    /// <summary>Optional additional notes.</summary>
    public string? Notes { get; set; }

    /// <summary>Maps a <see cref="Supplement"/> to a response DTO.</summary>
    public static TemplateSupplementDto FromDocument(Supplement supplement) => new()
    {
        ExternalId = supplement.ExternalId,
        Name = supplement.Name,
        Dose = supplement.Dose,
        Notes = supplement.Notes
    };
}

/// <summary>
/// Full nutrition-plan-template detail including all weeks, days, meals, foods, recipes, and
/// supplements. Used by the detail <c>GET</c> and by <c>PUT</c>'s response.
/// </summary>
public class NutritionPlanTemplateDetailDto
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
    /// Dietary style this template targets.
    /// </summary>
    public DietaryStyle? DietaryStyle { get; set; }

    /// <summary>
    /// Global daily nutrition targets.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// Supplement recommendations carried by this template.
    /// </summary>
    public List<TemplateSupplementDto> Supplements { get; set; } = [];

    /// <summary>
    /// All weeks in the template with their days, meals, foods, and recipes.
    /// </summary>
    public List<TemplateWeek> Weeks { get; set; } = [];

    /// <summary>
    /// Number of weeks, server-computed from <see cref="Weeks"/>.
    /// </summary>
    public int WeekCount { get; set; }

    /// <summary>
    /// Who can read this entry besides its owner.
    /// </summary>
    public LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// True when the authenticated caller is the nutritionist who owns this template.
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
    /// Maps a <see cref="NutritionPlanTemplate"/> document to a detailed response DTO.
    /// </summary>
    /// <param name="template">The nutrition plan template document.</param>
    /// <param name="currentUserId">Id of the authenticated caller.</param>
    public static NutritionPlanTemplateDetailDto FromDocument(NutritionPlanTemplate template, Guid currentUserId) => new()
    {
        TemplateId = template.ExternalId,
        Name = template.Name,
        Description = template.Description,
        Goal = template.Goal,
        DietaryStyle = template.DietaryStyle,
        GlobalSettings = template.GlobalSettings,
        Supplements = template.Supplements.Select(TemplateSupplementDto.FromDocument).ToList(),
        Weeks = template.Weeks,
        WeekCount = template.WeekCount,
        Visibility = template.Visibility,
        IsOwnedByCurrentUser = template.OwnerId == currentUserId,
        Version = template.Version,
        DateCreated = template.DateCreated,
        DateUpdated = template.DateUpdated
    };
}
