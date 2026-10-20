using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Pure date math for the events the worker polls for (client joined, check-in missed, client
/// inactive, form answered): when a send falls due once the event has been observed.
/// </summary>
public static class AutomationPolledEventCalculator
{
    /// <summary>How far back a due send is still picked up, so a short worker outage loses nothing.</summary>
    public static readonly TimeSpan Lookback = TimeSpan.FromDays(2);

    /// <summary>Whether the event is one the worker polls for rather than reads from a plan window.</summary>
    public static bool IsPolled(AutomationEventType? eventType) =>
        eventType is AutomationEventType.ClientJoined
            or AutomationEventType.CheckInMissed
            or AutomationEventType.ClientInactive
            or AutomationEventType.FormAnswered;

    /// <summary>
    /// The number of days after an event a send lands. An event is already in the past when it is
    /// observed, so a Before offset cannot move the send ahead of it and counts as no offset.
    /// </summary>
    /// <param name="offsetDays">The rule's offset; null means 0.</param>
    /// <param name="direction">The rule's offset direction; null means After.</param>
    public static int ShiftDays(int? offsetDays, AutomationOffsetDirection? direction) =>
        direction == AutomationOffsetDirection.Before ? 0 : Math.Max(0, offsetDays ?? 0);

    /// <summary>
    /// Computes the send instant (UTC): the client-local send time on the event's local date plus
    /// <paramref name="shiftDays"/>. With no shift, a send time that already passed on the event's own
    /// day moves to the next day, so a send never precedes the event it reacts to.
    /// </summary>
    /// <param name="eventAtUtc">When the event happened (UTC).</param>
    /// <param name="shiftDays">Whole days between the event and the send.</param>
    /// <param name="localTime">Client-local send time; null means <see cref="AutomationPlanEventCalculator.DefaultLocalTime"/>.</param>
    /// <param name="zone">The client's time zone.</param>
    public static DateTime ComputeFireAt(DateTime eventAtUtc, int shiftDays, TimeOnly? localTime, TimeZoneInfo zone)
    {
        var sendTime = localTime ?? AutomationPlanEventCalculator.DefaultLocalTime;
        var eventDate = ClientLocalDateResolver.ResolveLocalDate(eventAtUtc, zone);
        var shift = Math.Max(0, shiftDays);
        var fireAt = AutomationScheduleCalculator.ToUtc(eventDate.AddDays(shift), sendTime, zone);

        return shift == 0 && fireAt <= eventAtUtc
            ? AutomationScheduleCalculator.ToUtc(eventDate.AddDays(1), sendTime, zone)
            : fireAt;
    }
}
