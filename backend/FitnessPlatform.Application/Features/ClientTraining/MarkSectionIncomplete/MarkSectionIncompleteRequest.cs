namespace FitnessPlatform.Application.Features.ClientTraining.MarkSectionIncomplete;

/// <summary>
/// Request model for un-marking a section as complete.
/// </summary>
public class MarkSectionIncompleteRequest
{
    /// <summary>
    /// The session ID (from the training plan). Bound from the route.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The section ID within the session. Bound from the route.
    /// </summary>
    public Guid SectionId { get; set; }

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
