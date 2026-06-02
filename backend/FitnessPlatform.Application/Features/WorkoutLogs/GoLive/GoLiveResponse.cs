namespace FitnessPlatform.Application.Features.WorkoutLogs.GoLive;

/// <summary>
/// Response returned when a workout log transitions to Live state.
/// </summary>
public class GoLiveResponse
{
    /// <summary>
    /// The external ID of the workout log now in Live state.
    /// </summary>
    public Guid LogId { get; set; }

    /// <summary>
    /// UTC timestamp when the Live lock was acquired.
    /// </summary>
    public DateTime LiveAt { get; set; }
}
