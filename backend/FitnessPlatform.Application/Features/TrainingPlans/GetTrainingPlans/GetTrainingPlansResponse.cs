using FitnessPlatform.Application.Features.TrainingPlans.Shared;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlans;

/// <summary>
/// Paginated response containing a list of training plan summaries.
/// </summary>
public class GetTrainingPlansResponse
{
    /// <summary>
    /// List of plan summaries for the current page.
    /// </summary>
    public List<TrainingPlanSummaryDto> Plans { get; set; } = [];

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
