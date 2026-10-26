using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Creates the in-app <c>InvitationReceived</c> notification for each live
/// <see cref="PendingInvite"/> already addressed to a newly-verified client account (#1676).
/// </summary>
public interface IPendingInviteNotificationSeeder
{
    /// <summary>
    /// Notifies <paramref name="newUser"/> of every pending, unexpired invite matching their email,
    /// using the same payload as the invite-time notification. Idempotent per invite.
    /// </summary>
    /// <param name="newUser">The just-verified client user.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SeedForNewUserAsync(ApplicationUser newUser, CancellationToken ct);
}
