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
    /// Most common meal count over the template's non-empty days (days with at least one meal,
    /// across all weeks); ties resolve to the smaller count. Null when no day has a meal.
    /// </summary>
    public int? MealsPerDay { get; set; }

    /// <summary>
    /// Average kcal per non-empty day, in whole kcal. Null when no day has a meal.
    /// </summary>
    public decimal? AvgKcalPerDay { get; set; }

    /// <summary>
    /// Number of the caller's own Active plans instantiated from this template; other
    /// nutritionists' usage is never counted.
    /// </summary>
    public int UsedBy { get; set; }

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
    /// Maps a <see cref="NutritionPlanTemplate"/> document to a summary DTO.
    /// </summary>
    /// <param name="template">The nutrition plan template document.</param>
    /// <param name="currentUserId">Id of the authenticated caller.</param>
    /// <param name="usedBy">The caller's Active plan count for this template (0 outside search).</param>
    public static NutritionPlanTemplateSummaryDto FromDocument(
        NutritionPlanTemplate template, Guid currentUserId, int usedBy = 0) => new()
    {
        TemplateId = template.ExternalId,
        Name = template.Name,
        Description = template.Description,
        Goal = template.Goal,
        DietaryStyle = template.DietaryStyle,
        WeekCount = template.WeekCount,
        MealsPerDay = template.MealsPerDay,
        AvgKcalPerDay = template.AvgKcalPerDay,
        UsedBy = usedBy,
        Visibility = template.Visibility,
        IsOwnedByCurrentUser = template.OwnerId == currentUserId,
        Version = template.Version,
        DateCreated = template.DateCreated,
        DateUpdated = template.DateUpdated
    };
}
