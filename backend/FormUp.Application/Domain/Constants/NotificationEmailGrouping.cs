using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Constants;

/// <summary>
/// How long a burst of events waits before it is sent as one email: after a quiet gap, or at the latest a
/// fixed time after the first event. One row per event, so another grouped event only adds a line here.
/// </summary>
public static class NotificationEmailGrouping
{
    private static readonly IReadOnlyDictionary<NotificationEvent, (TimeSpan Quiet, TimeSpan Max)> Table =
        new Dictionary<NotificationEvent, (TimeSpan Quiet, TimeSpan Max)>
        {
            [NotificationEvent.NewMessage] = (TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(15)),
        };

    /// <summary>
    /// The quiet gap after the last event that ends a burst.
    /// </summary>
    /// <param name="notificationEvent">A grouped event.</param>
    public static TimeSpan QuietWindow(NotificationEvent notificationEvent) => Table[notificationEvent].Quiet;

    /// <summary>
    /// The longest a burst may wait after its first event.
    /// </summary>
    /// <param name="notificationEvent">A grouped event.</param>
    public static TimeSpan MaxWindow(NotificationEvent notificationEvent) => Table[notificationEvent].Max;

    /// <summary>
    /// When a burst is due: the quiet gap after its last event, but never later than the maximum wait after its first.
    /// </summary>
    /// <param name="notificationEvent">A grouped event.</param>
    /// <param name="firstEventAt">When the burst began (UTC).</param>
    /// <param name="lastEventAt">When the latest event happened (UTC).</param>
    public static DateTime DueAt(NotificationEvent notificationEvent, DateTime firstEventAt, DateTime lastEventAt)
    {
        var (quiet, max) = Table[notificationEvent];
        var afterQuiet = lastEventAt + quiet;
        var afterMax = firstEventAt + max;

        return afterQuiet < afterMax ? afterQuiet : afterMax;
    }
}
