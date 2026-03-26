namespace FitnessPlatform.Application.Features.WorkoutLogs.GetWorkoutLog;

/// <summary>
/// Request to get a single workout log detail.
/// </summary>
public class GetWorkoutLogRequest
{
    /// <summary>The workout log's public identifier.</summary>
    public Guid LogId { get; set; }
}
