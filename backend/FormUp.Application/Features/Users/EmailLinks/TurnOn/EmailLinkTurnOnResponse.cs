using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.Users.EmailLinks.Shared;

namespace FormUp.Application.Features.Users.EmailLinks.TurnOn;

/// <summary>
/// The email switch that was turned back on.
/// </summary>
public class EmailLinkTurnOnResponse
{
    /// <summary>Email address of the account the link belongs to.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>The notification event whose email is now on.</summary>
    public NotificationEvent Event { get; set; }

    internal static EmailLinkTurnOnResponse FromOutcome(EmailLinkOutcome outcome) => new()
    {
        Email = outcome.Email,
        Event = outcome.Event,
    };
}
