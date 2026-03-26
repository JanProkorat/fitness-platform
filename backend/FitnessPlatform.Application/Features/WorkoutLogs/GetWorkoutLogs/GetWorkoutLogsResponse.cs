using FitnessPlatform.Application.Features.WorkoutLogs.Shared;

namespace FitnessPlatform.Application.Features.WorkoutLogs.GetWorkoutLogs;

/// <summary>
/// Paginated response with workout log summaries.
/// </summary>
public class GetWorkoutLogsResponse
{
    /// <summary>List of workout log summaries.</summary>
    public List<WorkoutLogSummary> Logs { get; set; } = [];

    /// <summary>Total count of matching logs.</summary>
    public long TotalCount { get; set; }

    /// <summary>Current page.</summary>
    public int Page { get; set; }

    /// <summary>Page size.</summary>
    public int PageSize { get; set; }
}
