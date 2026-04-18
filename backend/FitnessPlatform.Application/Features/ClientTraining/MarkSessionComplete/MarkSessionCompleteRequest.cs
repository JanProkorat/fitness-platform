namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionComplete;

/// <summary>
/// Request model for marking an entire session complete (fans out to all exercises).
/// </summary>
public class MarkSessionCompleteRequest
{
    /// <summary>
    /// The session ID (from the training plan). Bound from the route.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The date on which the session was completed (UTC date only).
    /// Defaults to today UTC when not provided.
    /// </summary>
    public DateOnly? CompletedOn { get; set; }

    /// <summary>
    /// Client-supplied version for optimistic concurrency when updating an existing completion document.
    /// </summary>
    public int? Version { get; set; }
}
