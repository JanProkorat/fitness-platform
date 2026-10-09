using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Default email and push choices applied when a user has no saved row for an event.
/// </summary>
public static class NotificationPreferenceDefaults
{
    private static readonly IReadOnlyDictionary<NotificationEvent, (bool Email, bool Push)> Table =
        new Dictionary<NotificationEvent, (bool Email, bool Push)>
        {
            [NotificationEvent.NewMessage] = (true, true),
            [NotificationEvent.WeeklyCheckInSubmitted] = (true, true),
            [NotificationEvent.JoinRequest] = (true, true),
            [NotificationEvent.ProgressPhotosSubmitted] = (false, true),
            [NotificationEvent.WorkoutFinished] = (false, false),
        };

    /// <summary>
    /// Every event, in display order.
    /// </summary>
    public static IReadOnlyList<NotificationEvent> AllEvents { get; } = [.. Table.Keys];

    /// <summary>
    /// Returns the default email and push choice for an event.
    /// </summary>
    public static (bool Email, bool Push) For(NotificationEvent notificationEvent) => Table[notificationEvent];
}
