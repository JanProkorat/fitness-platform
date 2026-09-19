namespace FitnessPlatform.Application.Features.Messaging.Broadcast;

/// <summary>
/// Request to send the same text message to several clients at once.
/// </summary>
public class BroadcastMessageRequest
{
    /// <summary>
    /// The recipients' <c>ClientProfile.PublicId</c>. Duplicates are ignored.
    /// </summary>
    public List<Guid> ClientPublicIds { get; set; } = [];

    /// <summary>
    /// The message text. Supports <c>{{firstName}}</c> and <c>{{fullName}}</c> placeholders,
    /// substituted per recipient before the message is sent.
    /// </summary>
    public string Text { get; set; } = string.Empty;
}
