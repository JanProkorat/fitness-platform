namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionIncomplete;

/// <summary>
/// Request model for un-marking an entire session as complete.
/// </summary>
public class MarkSessionIncompleteRequest
{
    /// <summary>
    /// The session ID (from the training plan). Bound from the route.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The date for which the completion should be removed (UTC date only).
    /// Defaults to today UTC when not provided.
    /// </summary>
    public DateOnly? CompletedOn { get; set; }

    /// <summary>
    /// Client-supplied version for optimistic concurrency.
    /// </summary>
    public int? Version { get; set; }
}
