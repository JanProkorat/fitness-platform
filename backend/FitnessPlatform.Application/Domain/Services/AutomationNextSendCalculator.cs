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
    /// Computes the next send (UTC) for one client; null when the rule is disabled, paused, or has no
    /// computable date (an event other than plan started or ended).
    /// </summary>
    /// <param name="effective">The rule as the client experiences it.</param>
    /// <param name="zone">The client's time zone.</param>
    /// <param name="scheduleStartLocalDate">The client's schedule start date in their local calendar.</param>
    /// <param name="planWindows">The coach's plan windows for the client; read only by plan-event rules.</param>
    /// <param name="nowUtc">The current instant.</param>
    public static DateTime? Compute(
        AutomationEffectiveRule effective,
        TimeZoneInfo zone,
        DateOnly scheduleStartLocalDate,
        IEnumerable<AutomationPlanWindow> planWindows,
        DateTime nowUtc)
    {
        if (!effective.Enabled || effective.IsPaused)
        {
            return null;
        }

        if (effective.TriggerKind == AutomationTriggerKind.Schedule)
        {
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
