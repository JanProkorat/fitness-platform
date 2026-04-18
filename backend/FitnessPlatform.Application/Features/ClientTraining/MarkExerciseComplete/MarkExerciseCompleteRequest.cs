namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;

/// <summary>
/// Request model for marking a single exercise complete within a session.
/// </summary>
public class MarkExerciseCompleteRequest
{
    /// <summary>
    /// The session ID (from the training plan). Bound from the route.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The exercise external ID within the session. Bound from the route.
    /// </summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>
    /// The date on which the exercise was completed (UTC date only).
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
