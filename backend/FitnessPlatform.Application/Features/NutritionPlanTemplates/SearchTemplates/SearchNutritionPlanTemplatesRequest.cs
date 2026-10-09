using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.SearchTemplates;

/// <summary>
/// Request to search nutrition plan templates with optional filters and pagination.
/// </summary>
public class SearchNutritionPlanTemplatesRequest
{
    /// <summary>
    /// Optional case-insensitive substring match against the template name.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Optional filter by primary fitness goal.
    /// </summary>
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Optional filter by dietary style.
    /// </summary>
    public DietaryStyle? DietaryStyle { get; set; }

    /// <summary>
    /// Optional filter by exact week count.
    /// </summary>
    public int? WeekCount { get; set; }

    /// <summary>
    /// Optional filter by exact meals-per-day (most common meal count over non-empty days).
    /// </summary>
    public int? MealsPerDay { get; set; }

    /// <summary>
    /// Optional filter on whether the caller has at least one Active plan instantiated from the template.
    /// </summary>
    public bool? InUse { get; set; }

    /// <summary>
    /// Page number (1-based).
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
