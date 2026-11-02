using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// The single next-send computation for an effective rule, shared by every surface that shows or
/// stores a next send so the shown and the stored value cannot drift.
/// </summary>
public static class AutomationNextSendCalculator
{
    /// <summary>
    /// The client's start date in their local calendar: schedule occurrences count from it.
    /// </summary>
    /// <param name="scheduleStartedAtUtc">When the coach's earliest live link to the client began (UTC).</param>
    /// <param name="zone">The client's time zone.</param>
    public static DateOnly ResolveStartLocalDate(DateTime scheduleStartedAtUtc, TimeZoneInfo zone) =>
        ClientLocalDateResolver.ResolveLocalDate(scheduleStartedAtUtc, zone);

    /// <summary>
    /// The moment a weekly check-in may not start before: the later of the collaboration start and when the
    /// rule (or the client's customised override) was last written, which is when it was enabled or edited.
    /// </summary>
    /// <param name="collaborationStartedAtUtc">When the current collaboration began (link activation, else creation).</param>
    /// <param name="rule">The rule.</param>
    /// <param name="clientOverride">The client's override of the rule, if any.</param>
    public static DateTime ResolveFirstSendNotBefore(
        DateTime collaborationStartedAtUtc, AutomationRule rule, AutomationClientOverride? clientOverride)
    {
        var notBefore = Max(collaborationStartedAtUtc, rule.DateUpdated ?? rule.DateCreated);

        return clientOverride is { IsCustomized: true }
            ? Max(notBefore, clientOverride.DateUpdated ?? clientOverride.DateCreated)
            : notBefore;
    }

    private static DateTime Max(DateTime first, DateTime second) => first >= second ? first : second;

    /// <summary>
    /// Computes the next send (UTC) for one client; null when the rule is disabled, paused, or has no
    /// computable date (an event other than plan started or ended).
    /// </summary>
    /// <param name="effective">The rule as the client experiences it.</param>
    /// <param name="zone">The client's time zone.</param>
    /// <param name="scheduleStartLocalDate">The client's schedule start date in their local calendar.</param>
    /// <param name="planWindows">The coach's plan windows for the client; read only by plan-event rules.</param>
    /// <param name="nowUtc">The current instant.</param>
    /// <param name="firstSendNotBeforeUtc">
    /// For a weekday-anchored (check-in) rule: the moment before which no week may count as the first
    /// one; see <see cref="ResolveFirstSendNotBefore"/>. Null applies no bound.
    /// </param>
    public static DateTime? Compute(
        AutomationEffectiveRule effective,
        TimeZoneInfo zone,
        DateOnly scheduleStartLocalDate,
        IEnumerable<AutomationPlanWindow> planWindows,
        DateTime nowUtc,
        DateTime? firstSendNotBeforeUtc = null)
    {
        if (!effective.Enabled || effective.IsPaused)
        {
            return null;
        }

        if (effective.TriggerKind == AutomationTriggerKind.Schedule)
        {
            if (effective.ScheduleWeekday is { } weekday)
            {
                if (effective.LocalTime is not { } localTime)
                {
                    return null;
                }

                var next = AutomationScheduleCalculator.ComputeNextWeekdayRunAt(weekday, localTime, zone, nowUtc);

                // A weekly check-in starts with the first full week after the collaboration began and the
                // rule was enabled; later weeks follow the weekday as usual.
                if (firstSendNotBeforeUtc is { } notBefore)
                {
                    var first = AutomationScheduleCalculator.ComputeFirstFullWeekRunAt(weekday, localTime, zone, notBefore);

                    if (first > next)
                    {
                        next = first;
                    }
                }

                return next;
            }

            if (effective.ScheduleInterval is null || effective.ScheduleUnit is null || effective.LocalTime is null)
            {
                return null;
            }

            return AutomationScheduleCalculator.ComputeNextRunAt(
                effective.ScheduleInterval.Value,
                effective.ScheduleUnit.Value,
                effective.LocalTime.Value,
                zone,
                scheduleStartLocalDate,
                nowUtc);
        }

        return AutomationPlanEventCalculator.ComputeNextSendAt(
            effective.EventType,
            effective.EventOffsetDays,
            effective.EventOffsetDirection,
            effective.LocalTime,
            zone,
            planWindows,
            nowUtc);
    }
}
