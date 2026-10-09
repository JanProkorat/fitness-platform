using FitnessPlatform.Application.Features.Users.Shared;

namespace FitnessPlatform.Application.Features.Users.GetNotificationPreferences;

/// <summary>
/// The caller's notification preferences for all events.
/// </summary>
public class GetNotificationPreferencesResponse
{
    /// <summary>One entry per notification event.</summary>
    public List<NotificationPreferenceDto> Preferences { get; set; } = [];
}
