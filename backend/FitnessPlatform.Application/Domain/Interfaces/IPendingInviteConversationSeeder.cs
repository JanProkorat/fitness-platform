using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Seeds professional-client conversations for a newly-created <see cref="ApplicationUser"/>
/// against any message-bearing <see cref="PendingInvite"/> already addressed to their email.
/// </summary>
/// <remarks>
/// Extracted (rule of three, per <c>rules/code-quality.md#no-re-layered-services</c>) — the
/// same "look up pending invites by email, seed a conversation per qualifying invite" shape
/// is needed identically by <c>RegisterEndpoint</c>, <c>GoogleSocialLoginEndpoint</c>, and
/// <c>AppleSocialLoginEndpoint</c> the moment a brand-new account is provisioned (#803/#817).
/// <para>
/// Root cause this closes: <see cref="Conversation"/> is keyed on
/// (ProfessionalUserId, ClientUserId) — both real <see cref="ApplicationUser"/> ids. For the
/// common "invite a prospective client with no account yet" case, the conversation cannot be
/// seeded at invite-creation time. Account creation is the earliest possible seam, so this
/// helper runs there instead of waiting for invite-accept (which previously hid the coach's
/// opening message from Messages until the client decided).
/// </para>
/// </remarks>
public interface IPendingInviteConversationSeeder
{
    /// <summary>
    /// Looks up all non-accepted <see cref="PendingInvite"/> rows addressed to
    /// <paramref name="newUser"/>'s email that carry a non-empty <c>Message</c>, and seeds a
    /// professional-client conversation (with that message as the opening chat message) for
    /// each one via <see cref="IConversationSeedService.GetOrSeedConversationAsync"/>
    /// (<c>seedIntoExisting: false</c> — matches the existing accept-time idempotency
    /// contract, so a later accept of the same invite is a no-op).
    /// </summary>
    /// <param name="newUser">
    /// The just-created user. Must already have <c>NormalizedEmail</c> populated (i.e. called
    /// after <c>UserManager.CreateAsync</c> succeeds).
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    /// <remarks>
    /// A no-op if no pending invite matches the email, or if every matching invite has no
    /// message — this never creates an empty conversation shell. A client can have multiple
    /// pending invites from different coaches; each qualifying one seeds its own conversation.
    /// </remarks>
    Task SeedForNewUserAsync(ApplicationUser newUser, CancellationToken ct);
}
