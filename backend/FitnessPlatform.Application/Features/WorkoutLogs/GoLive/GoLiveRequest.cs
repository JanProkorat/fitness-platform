namespace FitnessPlatform.Application.Features.WorkoutLogs.GoLive;

/// <summary>
/// Request to transition an existing draft workout log to Live state.
/// </summary>
public class GoLiveRequest
{
    /// <summary>
    /// The external ID of the workout log to go live with.
    /// Bound from the route segment {logId}.
    /// </summary>
    public Guid LogId { get; set; }
}
