using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Users.EmailLinks.Shared;

/// <summary>
/// The sequence the three notification email link endpoints share: check the token, confirm the account still
/// exists, set only that event's email switch.
/// </summary>
internal static class EmailLinkPreferenceSwitch
{
    /// <summary>Fallback message for every invalid link; the same text whatever the reason.</summary>
    public const string InvalidMessage = "The link is invalid or has expired.";

    /// <summary>
    /// Sets the email switch the token points at. Returns null, with nothing written, for every invalid case
    /// (bad token, expired, deleted account) so the caller can answer them all the same way.
    /// </summary>
    /// <param name="tokens">Token service.</param>
    /// <param name="db">Application database context.</param>
    /// <param name="token">The token from the link.</param>
    /// <param name="emailEnabled">The new value of the email switch.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<EmailLinkOutcome?> TrySetAsync(
        IEmailTurnOffTokenService tokens,
        IApplicationDbContext db,
        string? token,
        bool emailEnabled,
        CancellationToken ct)
    {
        if (tokens.Validate(token) is not { } claims)
        {
            return null;
        }

        var email = await db.Users
            .AsNoTracking()
            .Where(user => user.Id == claims.UserId)
            .Select(user => user.Email)
            .FirstOrDefaultAsync(ct);

        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        await db.UpsertNotificationEmailEnabledAsync(
            claims.UserId,
            claims.Event,
            emailEnabled,
            NotificationPreferenceDefaults.For(claims.Event).Push,
            ct);

        return new EmailLinkOutcome(claims.UserId, email, claims.Event);
    }
}
