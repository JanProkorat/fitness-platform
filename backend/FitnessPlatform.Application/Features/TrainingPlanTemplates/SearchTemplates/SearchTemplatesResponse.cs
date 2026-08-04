using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.SearchTemplates;

/// <summary>
/// Paginated response containing a list of training plan template summaries.
/// </summary>
public class SearchTemplatesResponse
{
    /// <summary>
    /// List of template summaries for the current page.
    /// </summary>
    public List<TrainingPlanTemplateSummaryDto> Templates { get; set; } = [];

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
