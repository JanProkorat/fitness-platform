namespace FitnessPlatform.Application.Features.ClientTraining.MarkSectionComplete;

/// <summary>
/// Request model for marking a section complete within a session.
/// Used for sections that have no exercises (e.g. a ForTime "Running" section).
/// </summary>
public class MarkSectionCompleteRequest
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
    /// The date on which the section was completed (UTC date only).
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
