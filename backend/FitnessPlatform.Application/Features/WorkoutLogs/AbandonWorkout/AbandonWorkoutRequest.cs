namespace FitnessPlatform.Application.Features.WorkoutLogs.AbandonWorkout;

/// <summary>
/// Request to abandon (discard) a draft workout session and release the Live lock.
/// </summary>
public class AbandonWorkoutRequest
{
    /// <summary>
    /// The external ID of the workout log to abandon.
    /// Bound from the route segment {logId}.
    /// </summary>
    public Guid LogId { get; set; }
}
