namespace FitnessPlatform.Application.Features.ClientTraining.MarkWorkoutIncomplete;

/// <summary>
/// Request model for un-marking a workout as complete.
/// </summary>
public class MarkWorkoutIncompleteRequest
{
    /// <summary>
    /// The session ID (from the training plan). Bound from the route.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The workout ID within the session. Bound from the route.
    /// </summary>
    public Guid WorkoutId { get; set; }

    /// <summary>
    /// The date for which the completion should be removed (UTC date only).
    /// Defaults to today UTC when not provided.
    /// </summary>
    public DateOnly? CompletedOn { get; set; }

    /// <summary>
    /// Client-supplied version of the completion document for optimistic concurrency.
    /// </summary>
    public int? Version { get; set; }
}
