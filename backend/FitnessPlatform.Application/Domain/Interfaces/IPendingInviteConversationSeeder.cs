using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Seeds professional-client conversations for a newly-VERIFIED <see cref="ApplicationUser"/>
/// against any non-accepted <see cref="PendingInvite"/> already addressed to their email.
/// </summary>
/// <remarks>
/// Extracted (rule of three, per <c>rules/code-quality.md#no-re-layered-services</c>) — the
/// same "look up pending invites by email, seed a conversation per qualifying invite" shape
/// is needed identically by <c>VerifyEmailEndpoint</c>, <c>GoogleSocialLoginEndpoint</c>, and
/// <c>AppleSocialLoginEndpoint</c> the moment an account becomes verified (#803/#817, moved
/// from <c>RegisterEndpoint</c> to <c>VerifyEmailEndpoint</c> for #1100 — R4: invite threads
/// exist only for verified accounts, since <c>Login</c> does not itself block an unverified
/// one).
/// <para>
/// Root cause this closes: <see cref="Conversation"/> is keyed on
/// (ProfessionalUserId, ClientUserId) — both real <see cref="ApplicationUser"/> ids. For the
/// common "invite a prospective client with no account yet" case, the conversation cannot be
/// seeded at invite-creation time. Verification is the earliest seam at which the invitee's
/// identity is trustworthy, so this helper runs there instead of waiting for invite-accept
/// (which previously hid the coach's opening message from Messages until the client decided).
/// </para>
/// </remarks>
public interface IPendingInviteConversationSeeder
{
    /// <summary>
    /// Looks up all non-accepted <see cref="PendingInvite"/> rows addressed to
    /// <paramref name="newUser"/>'s email and seeds an Invited cooperation event — plus the
    /// invite's <c>Message</c> beneath it as a plain chat message, when non-empty — for each
    /// one, via
    /// <see cref="IConversationSeedService.AppendCooperationEventAsync"/>. A message-less
    /// invite still gets its own thread (the banner alone); idempotency is keyed on the
    /// invite's <c>PublicId</c>, not on message presence.
    /// </summary>
    /// <param name="newUser">
    /// The just-verified user. Must already have <c>NormalizedEmail</c> populated.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    /// <remarks>
    /// A no-op if no pending invite matches the email. A client can have multiple pending
    /// invites from different coaches; each qualifying one seeds its own conversation. Calling
    /// this twice for the same invite (e.g. a coach's invite races an account already
    /// verified) is a no-op on the second call — see
    /// <see cref="IConversationSeedService.AppendCooperationEventAsync"/>'s own idempotency
    /// contract.
    /// </remarks>
    Task SeedForNewUserAsync(ApplicationUser newUser, CancellationToken ct);
}
