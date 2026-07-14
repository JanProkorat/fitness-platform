using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Gets or creates the professional-client <see cref="Conversation"/> and, on first
/// creation only, seeds it with an initial message authored by one of the two
/// participants. Used by flows that need a professional's own free-text (an invite's
/// personal message, an accept-time statement) to surface as a real chat message on
/// both participants' Messages screens, instead of being silently dropped.
/// </summary>
/// <remarks>
/// Extracted (rule of three, per
/// <c>rules/code-quality.md#no-re-layered-services</c>) once the same
/// get-or-create-conversation + append-first-message + broadcast "newmessage" shape
/// was needed by <c>CreatePendingInviteEndpoint</c>, <c>AcceptClientInviteEndpoint</c>,
/// and <c>AcceptInvitationEndpoint</c> (#768).
/// </remarks>
public interface IConversationSeedService
{
    /// <summary>
    /// Gets or creates the conversation between <paramref name="professionalUserId"/>
    /// and <paramref name="clientUserId"/>. If the conversation did NOT already exist
    /// and <paramref name="messageText"/> is non-empty, appends it as the conversation's
    /// first message (authored by <paramref name="senderUserId"/>, which must be one of
    /// the two participants) and broadcasts the existing "newmessage" SignalR event to
    /// the other participant.
    /// </summary>
    /// <remarks>
    /// Idempotent by construction: the message step only ever runs against a
    /// brand-new conversation. If the conversation already exists — e.g. because an
    /// earlier call already delivered this same invite's message, or the two users
    /// were already chatting — the message step is skipped so re-processing an
    /// invite/acceptance never duplicates the seed message or the conversation.
    /// </remarks>
    Task<Conversation> GetOrSeedConversationAsync(
        Guid professionalUserId,
        Guid clientUserId,
        Guid senderUserId,
        string senderName,
        string? messageText,
        CancellationToken ct);
}
