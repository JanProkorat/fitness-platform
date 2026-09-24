using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>
/// One row of the professional caller's live client roster — the same population
/// <c>GetClientsEndpoint</c> shows on its default tab (live links only, archived links
/// excluded) — joined with the per-client facts
/// <see cref="Domain.Services.ClientRosterFilterClassifier"/> classifies against, plus the
/// client's existing conversation (if any) for display. Produced by
/// <see cref="ConversationRosterLoader"/> and shared by <c>GetConversationsEndpoint</c> and
/// <c>GetConversationFilterCountsEndpoint</c> so the two surfaces can never disagree about
/// which client belongs to which filter chip.
/// </summary>
public sealed class ConversationRosterRow
{
    /// <summary>The client's <c>ApplicationUser.Id</c>.</summary>
    public required Guid ClientUserId { get; init; }

    /// <summary>The client's <c>ClientProfile.PublicId</c>.</summary>
    public required Guid ClientPublicId { get; init; }

    /// <summary>The client's first name, for the conversation row's participant.</summary>
    public required string ClientFirstName { get; init; }

    /// <summary>The client's last name, for the conversation row's participant.</summary>
    public required string ClientLastName { get; init; }

    /// <summary>The client's user-level avatar. <c>ClientProfile</c> has no dedicated avatar.</summary>
    public string? ClientAvatarBlobUrl { get; init; }

    /// <summary>
    /// The existing conversation's <c>Conversation.PublicId</c>, or <c>null</c> when no
    /// conversation has been started with this client yet — conversation rows are created
    /// lazily, so a linked client may have none.
    /// </summary>
    public Guid? ConversationPublicId { get; init; }

    /// <summary>Preview text of the last message. Empty when no conversation exists.</summary>
    public string LastMessage { get; init; } = string.Empty;

    /// <summary>Timestamp of the last message. <see cref="DateTime.MinValue"/> when no conversation exists.</summary>
    public DateTime LastMessageAt { get; init; }

    /// <summary>The last message's sender, or <c>null</c> when no conversation exists.</summary>
    public Guid? LastMessageSenderId { get; init; }

    /// <summary>
    /// Whether the last message carries an image attachment. False when no conversation
    /// exists.
    /// </summary>
    public bool LastMessageHasImage { get; init; }

    /// <summary>
    /// The cooperation event type of the last message, when it was a system-generated event
    /// row. Null when no conversation exists, or the last message is plain text.
    /// </summary>
    public ChatEventType? LastMessageEventType { get; init; }

    /// <summary>Whether the caller (the professional) has archived this conversation.</summary>
    public bool IsArchivedByProfessional { get; init; }

    /// <summary>Total message count in the conversation. Zero when no conversation exists.</summary>
    public int ConversationMessageCount { get; init; }

    /// <summary>Number of unread messages sent by the client to the caller.</summary>
    public int UnreadMessageCount { get; init; }

    /// <summary>Whether the client has a responded, not-yet-reviewed weekly check-in.</summary>
    public bool HasNewCheckIn { get; init; }

    /// <summary>Whether the client has an expired or overdue-unanswered weekly check-in.</summary>
    public bool HasMissingCheckIn { get; init; }

    /// <summary>Whether the client's active plan window ends within 14 days.</summary>
    public bool IsEndingSoon { get; init; }
}
