namespace FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;

/// <summary>
/// Request to complete a workout session.
/// </summary>
public class CompleteWorkoutRequest
{
    /// <summary>
    /// The workout log's public identifier.
    /// </summary>
    public Guid LogId { get; set; }
}
