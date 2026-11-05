namespace FormUp.Application.Features.Users.EmailLinks.TurnOff;

/// <summary>
/// Request for turning off one notification email from the link in that email.
/// </summary>
public class EmailLinkTurnOffRequest
{
    /// <summary>The token from the emailed link.</summary>
    public string Token { get; set; } = string.Empty;
}
