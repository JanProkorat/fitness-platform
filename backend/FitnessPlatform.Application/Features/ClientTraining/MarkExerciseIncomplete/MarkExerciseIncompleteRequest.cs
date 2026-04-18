namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseIncomplete;

/// <summary>
/// Request model for un-marking a single exercise as complete.
/// </summary>
public class MarkExerciseIncompleteRequest
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
    /// The date for which the completion should be removed (UTC date only).
    /// Defaults to today UTC when not provided.
    /// </summary>
    public DateOnly? CompletedOn { get; set; }

    /// <summary>
    /// Client-supplied version of the completion document for optimistic concurrency.
    /// </summary>
    public int? Version { get; set; }
}
