using FitnessPlatform.Application.Features.Users.Shared;

namespace FitnessPlatform.Application.Features.Users.UpdateNotificationPreferences;

/// <summary>
/// Full set of notification preferences, one entry per event.
/// </summary>
public class UpdateNotificationPreferencesRequest
{
    /// <summary>Email and push choice for every notification event.</summary>
    public List<NotificationPreferenceDto> Preferences { get; set; } = [];
}
