using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.Users.EmailLinks.Shared;

namespace FormUp.Application.Features.Users.EmailLinks.TurnOff;

/// <summary>
/// The email switch that was turned off.
/// </summary>
public class EmailLinkTurnOffResponse
{
    /// <summary>Email address of the account the link belongs to.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>The notification event whose email is now off.</summary>
    public NotificationEvent Event { get; set; }

    internal static EmailLinkTurnOffResponse FromOutcome(EmailLinkOutcome outcome) => new()
    {
        Email = outcome.Email,
        Event = outcome.Event,
    };
}
