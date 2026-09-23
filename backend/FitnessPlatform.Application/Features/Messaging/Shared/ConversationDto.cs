namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>
/// A conversation as surfaced to the caller — used by both the conversation list and
/// get-or-create-conversation responses.
/// </summary>
public class ConversationDto
{
    /// <summary>
    /// The conversation's <c>Conversation.PublicId</c>. Null for a live-roster placeholder row
    /// (a linked client with no conversation yet) that still matched the requested filter chip —
    /// see <c>GetConversationsEndpoint</c>'s roster-filter path.
    /// </summary>
    public Guid? Id { get; set; }

    /// <summary>The other party in the conversation.</summary>
    public ParticipantDto Participant { get; set; } = null!;

    /// <summary>Preview text of the last message, truncated to 300 characters.</summary>
    public string LastMessage { get; set; } = string.Empty;

    /// <summary>Timestamp of the last message, or the conversation's creation time if empty.</summary>
    public DateTime LastMessageAt { get; set; }

    /// <summary>Whether the caller sent the last message.</summary>
    public bool LastMessageIsOwn { get; set; }

    /// <summary>Number of unread messages sent by the other party.</summary>
    public int UnreadCount { get; set; }

    /// <summary>
    /// Whether the last message carries an image attachment. The client renders a localized
    /// photo marker instead of raw text when this is true and <see cref="LastMessage"/> is
    /// empty — never a literal stored in the database.
    /// </summary>
    public bool LastMessageHasImage { get; set; }

    /// <summary>Whether the professional-client collaboration has ended.</summary>
    public bool IsFormer { get; set; }
}
