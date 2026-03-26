namespace FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;

/// <summary>
/// Request to start a new workout session.
/// </summary>
public class StartWorkoutRequest
{
    /// <summary>
    /// Optional reference to the training plan.
    /// </summary>
    public Guid? PlanId { get; set; }

    /// <summary>
    /// Optional reference to the training session within the plan.
    /// </summary>
    public Guid? SessionId { get; set; }
}
