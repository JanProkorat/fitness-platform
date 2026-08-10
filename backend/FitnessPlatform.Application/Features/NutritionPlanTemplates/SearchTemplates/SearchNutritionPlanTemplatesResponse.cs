using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.SearchTemplates;

/// <summary>
/// Paginated response containing a list of nutrition plan template summaries.
/// </summary>
public class SearchNutritionPlanTemplatesResponse
{
    /// <summary>
    /// List of template summaries for the current page.
    /// </summary>
    public List<NutritionPlanTemplateSummaryDto> Templates { get; set; } = [];

    /// <summary>
    /// Total number of templates matching the filter.
    /// </summary>
    public long TotalCount { get; set; }

    /// <summary>
    /// Current page number.
    /// </summary>
    public int Page { get; set; }

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; }
}
