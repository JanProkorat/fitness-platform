using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Gets or creates the professional-client <see cref="Conversation"/> and seeds it
/// with an initial message authored by one of the two participants. Used by flows
/// that need a professional's own free-text (an invite's personal message, an
/// accept-time statement) to surface as a real chat message on both participants'
/// Messages screens, instead of being silently dropped.
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
    /// and <paramref name="clientUserId"/>. If <paramref name="messageText"/> is
    /// non-empty, appends it as a message (authored by <paramref name="senderUserId"/>,
    /// which must be one of the two participants) and broadcasts the existing
    /// "newmessage" SignalR event to the other participant — but only when the
    /// conversation is brand-new, OR when <paramref name="seedIntoExisting"/> is true.
    /// </summary>
    /// <param name="professionalUserId">The professional participant's user id.</param>
    /// <param name="clientUserId">The client participant's user id.</param>
    /// <param name="senderUserId">
    /// The author of the seeded message — must equal either
    /// <paramref name="professionalUserId"/> or <paramref name="clientUserId"/>.
    /// </param>
    /// <param name="senderName">Display name used in the "newmessage" broadcast payload.</param>
    /// <param name="messageText">
    /// The message to seed. A null/whitespace value is a no-op for the message step
    /// (the conversation is still created if it didn't exist).
    /// </param>
    /// <param name="seedIntoExisting">
    /// <c>true</c> (invite-CREATION callers, e.g. <c>CreatePendingInviteEndpoint</c>):
    /// append the message even if the two participants already have a conversation —
    /// matches the pre-#768 behavior where re-inviting an already-conversing contact
    /// with a personal message still delivered it.
    /// <c>false</c> (invite-ACCEPT callers, e.g. <c>AcceptClientInviteEndpoint</c>,
    /// <c>AcceptInvitationEndpoint</c>): seed only into a brand-new conversation, so
    /// re-accepting/re-processing the same invite can never duplicate the message —
    /// the invitee either already got it seeded at invite-creation time (conversation
    /// already exists) or this is the first time it's ever delivered (conversation is
    /// new).
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    /// <remarks>
    /// Concurrency: a concurrent double-accept/double-invite race can make two
    /// requests both observe "no conversation yet" and both try to insert one. The
    /// unique index on (ProfessionalUserId, ClientUserId) lets only one insert win;
    /// the loser's <c>DbUpdateException</c> is caught internally, the now-existing
    /// conversation is re-queried, and the call is treated as the "already existed"
    /// branch (no seed, no duplicate, no 500).
    /// </remarks>
    Task<Conversation> GetOrSeedConversationAsync(
        Guid professionalUserId,
        Guid clientUserId,
        Guid senderUserId,
        string senderName,
        string? messageText,
        bool seedIntoExisting,
        CancellationToken ct);
}
