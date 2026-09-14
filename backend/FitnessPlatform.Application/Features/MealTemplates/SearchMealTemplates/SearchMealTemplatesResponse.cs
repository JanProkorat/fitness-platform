using FitnessPlatform.Application.Features.MealTemplates.Shared;

namespace FitnessPlatform.Application.Features.MealTemplates.SearchMealTemplates;

/// <summary>
/// Paginated response for meal template search results.
/// </summary>
public class SearchMealTemplatesResponse
{
    /// <summary>
    /// List of matching meal templates.
    /// </summary>
    public List<MealTemplateSummaryDto> Templates { get; set; } = [];

    /// <summary>
    /// Total number of matching templates.
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
