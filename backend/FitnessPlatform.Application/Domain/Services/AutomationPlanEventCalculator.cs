using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Pure date math for plan-started and plan-ended event rules: the next instant a send falls due.
/// </summary>
public static class AutomationPlanEventCalculator
{
    /// <summary>Client-local time an event rule sends at when it names no time of its own.</summary>
    public static readonly TimeOnly DefaultLocalTime = new(9, 0);

    /// <summary>
    /// Computes the earliest send instant (UTC) strictly after <paramref name="nowUtc"/> across the
    /// plan windows. A plan started on its start date and ended on its last day
    /// (<c>StartDate + WeekCount * 7 - 1</c>); the offset moves the send forward (After) or back (Before).
    /// </summary>
    /// <param name="eventType">PlanStarted or PlanEnded; any other event yields null.</param>
    /// <param name="offsetDays">Days between the event and the send; null means 0.</param>
    /// <param name="direction">Whether the send lands before or after the event; null means After.</param>
    /// <param name="localTime">Client-local send time; null means <see cref="DefaultLocalTime"/>.</param>
    /// <param name="zone">The client's time zone.</param>
    /// <param name="windows">The coach's plan windows for the client.</param>
    /// <param name="nowUtc">The current instant.</param>
    public static DateTime? ComputeNextSendAt(
        AutomationEventType? eventType,
        int? offsetDays,
        AutomationOffsetDirection? direction,
        TimeOnly? localTime,
        TimeZoneInfo zone,
        IEnumerable<AutomationPlanWindow> windows,
        DateTime nowUtc)
    {
        if (eventType is not (AutomationEventType.PlanStarted or AutomationEventType.PlanEnded))
        {
            return null;
        }

        var offset = offsetDays ?? 0;
        var shift = direction == AutomationOffsetDirection.Before ? -offset : offset;
        var sendTime = localTime ?? DefaultLocalTime;
        DateTime? earliest = null;

        foreach (var window in windows)
        {
            if (window.StartDate is null || (eventType == AutomationEventType.PlanEnded && window.WeekCount < 1))
            {
                continue;
            }

            var startDate = DateOnly.FromDateTime(window.StartDate.Value);
            var anchor = eventType == AutomationEventType.PlanStarted
                ? startDate
                : startDate.AddDays(window.WeekCount * 7 - 1);

            var sendAt = AutomationScheduleCalculator.ToUtc(anchor.AddDays(shift), sendTime, zone);

            if (sendAt > nowUtc && (earliest is null || sendAt < earliest))
            {
                earliest = sendAt;
            }
        }

        return earliest;
    }
}
