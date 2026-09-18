namespace FitnessPlatform.Application.Features.Messaging.Broadcast;

/// <summary>
/// Response for a message broadcast.
/// </summary>
public class BroadcastMessageResponse
{
    /// <summary>
    /// The number of distinct recipients the message was sent to.
    /// </summary>
    public int SentCount { get; set; }
}
