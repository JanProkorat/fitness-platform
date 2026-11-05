namespace FormUp.Application.Features.Users.EmailLinks.TurnOn;

/// <summary>
/// Request for turning a notification email back on from the link in that email.
/// </summary>
public class EmailLinkTurnOnRequest
{
    /// <summary>The token from the emailed link.</summary>
    public string Token { get; set; } = string.Empty;
}
