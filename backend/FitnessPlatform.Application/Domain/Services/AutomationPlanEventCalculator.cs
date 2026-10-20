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
        DateTime? earliest = null;

        foreach (var send in EnumerateSends(eventType, offsetDays, direction, localTime, zone, windows))
        {
            if (send.SendAt > nowUtc && (earliest is null || send.SendAt < earliest))
            {
                earliest = send.SendAt;
            }
        }

        return earliest;
    }

    /// <summary>
    /// Lists the sends whose instant lies in <c>[fromUtc, toUtc]</c>, one per plan, with the plan
    /// each hangs on. Uses the same anchor and offset math as <see cref="ComputeNextSendAt"/>.
    /// </summary>
    /// <param name="eventType">PlanStarted or PlanEnded; any other event yields nothing.</param>
    /// <param name="offsetDays">Days between the event and the send; null means 0.</param>
    /// <param name="direction">Whether the send lands before or after the event; null means After.</param>
    /// <param name="localTime">Client-local send time; null means <see cref="DefaultLocalTime"/>.</param>
    /// <param name="zone">The client's time zone.</param>
    /// <param name="windows">The coach's plan windows for the client.</param>
    /// <param name="fromUtc">Start of the range, inclusive.</param>
    /// <param name="toUtc">End of the range, inclusive.</param>
    public static IReadOnlyList<AutomationPlanSend> ComputeDueSends(
        AutomationEventType? eventType,
        int? offsetDays,
        AutomationOffsetDirection? direction,
        TimeOnly? localTime,
        TimeZoneInfo zone,
        IEnumerable<AutomationPlanWindow> windows,
        DateTime fromUtc,
        DateTime toUtc) =>
        EnumerateSends(eventType, offsetDays, direction, localTime, zone, windows)
            .Where(send => send.SendAt >= fromUtc && send.SendAt <= toUtc)
            .OrderBy(send => send.SendAt)
            .ThenBy(send => send.PlanId)
            .ToList();

    private static IEnumerable<AutomationPlanSend> EnumerateSends(
        AutomationEventType? eventType,
        int? offsetDays,
        AutomationOffsetDirection? direction,
        TimeOnly? localTime,
        TimeZoneInfo zone,
        IEnumerable<AutomationPlanWindow> windows)
    {
        if (eventType is not (AutomationEventType.PlanStarted or AutomationEventType.PlanEnded))
        {
            yield break;
        }

        var offset = offsetDays ?? 0;
        var shift = direction == AutomationOffsetDirection.Before ? -offset : offset;
        var sendTime = localTime ?? DefaultLocalTime;

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

            yield return new AutomationPlanSend(window.PlanId, anchor, sendAt);
        }
    }
}
