namespace FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;

/// <summary>
/// Response after starting a workout.
/// </summary>
public class StartWorkoutResponse
{
    /// <summary>
    /// The new workout log's public identifier.
    /// </summary>
    public Guid LogId { get; set; }

    /// <summary>
    /// When the workout was started.
    /// </summary>
    public DateTime StartedAt { get; set; }
}
