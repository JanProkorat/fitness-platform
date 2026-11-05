using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Interfaces;

/// <summary>
/// Issues and checks the stateless token behind a notification email's "Turn off these emails" link.
/// </summary>
public interface IEmailTurnOffTokenService
{
    /// <summary>
    /// Signs a link token for one user and event. The token is a URL-safe string; treat it as a credential and never log it.
    /// </summary>
    /// <param name="userId">The <c>ApplicationUser.Id</c> the email is sent to.</param>
    /// <param name="notificationEvent">The event whose email switch the link controls.</param>
    string Create(Guid userId, NotificationEvent notificationEvent);

    /// <summary>
    /// Checks a token and returns its claims, or null when it is malformed, tampered, signed with another key or
    /// purpose, from an unknown version, expired, or names an event that has no email. Callers must not tell
    /// these cases apart.
    /// </summary>
    /// <param name="token">The token from the link.</param>
    EmailTurnOffTokenClaims? Validate(string? token);
}
