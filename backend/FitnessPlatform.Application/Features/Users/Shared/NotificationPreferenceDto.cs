using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Users.Shared;

/// <summary>
/// Email and push choice for one notification event.
/// </summary>
public class NotificationPreferenceDto
{
    /// <summary>The notification event.</summary>
    public NotificationEvent Event { get; set; }

    /// <summary>Whether email delivery is enabled.</summary>
    public bool Email { get; set; }

    /// <summary>Whether push delivery is enabled.</summary>
    public bool Push { get; set; }
}
