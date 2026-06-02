namespace FitnessPlatform.Application.Features.WorkoutLogs.AbandonWorkout;

/// <summary>
/// Response returned when an abandon request is processed (including idempotent no-op case).
/// </summary>
public class AbandonWorkoutResponse
{
    /// <summary>
    /// Whether a Live lock was actually released. False when the lock was already gone (idempotent).
    /// </summary>
    public bool Released { get; set; }
}
