namespace FitnessPlatform.Application.Features.ClientTraining.MarkWorkoutComplete;

/// <summary>
/// Request model for marking a workout complete within a session.
/// Used for workouts that have no exercises (e.g. a ForTime "Running" workout).
/// </summary>
public class MarkWorkoutCompleteRequest
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
    /// The date on which the workout was completed (UTC date only).
    /// Defaults to today UTC when not provided.
    /// </summary>
    public DateOnly? CompletedOn { get; set; }

    /// <summary>
    /// Client-supplied version of the existing completion document, used for optimistic
    /// concurrency. Required when a completion document already exists for this
    /// (clientId, date, sessionId) tuple; ignored for new documents.
    /// </summary>
    public int? Version { get; set; }
}
