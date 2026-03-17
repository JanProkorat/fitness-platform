using FitnessPlatform.Application.Features.NutritionPlans.Shared;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlans;

/// <summary>
/// Paginated response containing a list of nutrition plan summaries.
/// </summary>
public class GetPlansResponse
{
    /// <summary>
    /// List of plan summaries for the current page.
    /// </summary>
    public List<PlanSummaryDto> Plans { get; set; } = [];

    /// <summary>
    /// Total number of plans matching the filter.
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
