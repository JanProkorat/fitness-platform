namespace FitnessPlatform.Application.Features.WorkoutLogs.GetWorkoutLogs;

/// <summary>
/// Request to list client's workout logs.
/// </summary>
public class GetWorkoutLogsRequest
{
    /// <summary>Page number (1-based).</summary>
    public int Page { get; set; } = 1;

    /// <summary>Number of items per page.</summary>
    public int PageSize { get; set; } = 20;
}
