using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>
/// A conversation as surfaced to the caller — used by both the conversation list and
/// get-or-create-conversation responses.
/// </summary>
public class ConversationDto
{
    /// <summary>
    /// The conversation's <c>Conversation.PublicId</c>. Always set by the list endpoint now
    /// (clients without a conversation are not listed); nullable only to keep the API contract.
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

    /// <summary>
    /// The cooperation event type of the last message, when it was a system-generated event
    /// row rather than plain text. Null when the last message is plain text.
    /// </summary>
    public ChatEventType? LastMessageEventType { get; set; }

    /// <summary>Whether the professional-client collaboration has ended.</summary>
    public bool IsFormer { get; set; }

    /// <summary>
    /// When the collaboration ended, for a former one. Null when it is not former or the end
    /// date is unknown.
    /// </summary>
    public DateTime? EndedAt { get; set; }

    /// <summary>
    /// The newest invite or client request between the two people. Null when there is none, or
    /// its source row no longer exists.
    /// </summary>
    public ConversationCooperationDto? Cooperation { get; set; }

    /// <summary>
    /// True exactly when sending in this thread would be refused for the caller with
    /// <c>CONVERSATION_LOCKED</c> (a professional in an invite-only thread). The web disables the
    /// composer on it.
    /// </summary>
    public bool IsSendLocked { get; set; }
}
