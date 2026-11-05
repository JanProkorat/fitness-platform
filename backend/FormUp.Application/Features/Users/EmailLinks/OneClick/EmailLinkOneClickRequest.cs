using FastEndpoints;

namespace FormUp.Application.Features.Users.EmailLinks.OneClick;

/// <summary>
/// Request for the RFC 8058 one-click unsubscribe post a mail client sends for a notification email.
/// </summary>
public class EmailLinkOneClickRequest
{
    /// <summary>The token from the <c>List-Unsubscribe</c> link's query string.</summary>
    [QueryParam]
    public string Token { get; set; } = string.Empty;
}
