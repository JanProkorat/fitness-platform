using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Pure date math for automation schedules: the next fire instant of an "every N days or weeks"
/// trigger in the client's time zone, and whether a per-client pause is still in effect.
/// </summary>
public static class AutomationScheduleCalculator
{
    /// <summary>
    /// Computes the next fire instant (UTC) strictly after <paramref name="nowUtc"/>. Occurrences are
    /// the client's start date plus whole multiples of the interval (the first one is one interval
    /// after the start date), each at <paramref name="localTime"/> in <paramref name="zone"/>.
    /// </summary>
    /// <param name="interval">Number of units between sends; below 1 yields null.</param>
    /// <param name="unit">Unit of the interval.</param>
    /// <param name="localTime">Client-local time of day.</param>
    /// <param name="zone">The client's time zone.</param>
    /// <param name="startLocalDate">The client's start date in their local calendar.</param>
    /// <param name="nowUtc">The current instant.</param>
    public static DateTime? ComputeNextRunAt(
        int interval,
        AutomationScheduleUnit unit,
        TimeOnly localTime,
        TimeZoneInfo zone,
        DateOnly startLocalDate,
        DateTime nowUtc)
    {
        if (interval < 1)
        {
            return null;
        }

        var stepDays = interval * (unit == AutomationScheduleUnit.Weeks ? 7 : 1);
        var localToday = ClientLocalDateResolver.ResolveLocalDate(nowUtc, zone);
        var elapsedSteps = Math.Max(0, (localToday.DayNumber - startLocalDate.DayNumber) / stepDays);
        var step = Math.Max(1, elapsedSteps);

        var candidate = ToUtc(startLocalDate.AddDays(step * stepDays), localTime, zone);

        while (candidate <= nowUtc)
        {
            step++;
            candidate = ToUtc(startLocalDate.AddDays(step * stepDays), localTime, zone);
        }

        return candidate;
    }

    /// <summary>
    /// Converts a local date and time to UTC. A time that does not exist because of a spring-forward
    /// gap moves one hour later; an ambiguous time resolves to the standard-time instant.
    /// </summary>
    public static DateTime ToUtc(DateOnly localDate, TimeOnly localTime, TimeZoneInfo zone)
    {
        var local = localDate.ToDateTime(localTime, DateTimeKind.Unspecified);

        if (zone.IsInvalidTime(local))
        {
            local = local.AddHours(1);
        }

        return TimeZoneInfo.ConvertTimeToUtc(local, zone);
    }

    /// <summary>
    /// Whether a pause is currently in effect. It lapses after <paramref name="pausedUntil"/> (the
    /// client's local calendar day) without any stored change.
    /// </summary>
    /// <param name="isPaused">The stored pause flag.</param>
    /// <param name="pausedUntil">Last local day of the pause; null means until resumed.</param>
    /// <param name="clientLocalToday">The client's current local date.</param>
    public static bool IsPauseEffective(bool isPaused, DateOnly? pausedUntil, DateOnly clientLocalToday) =>
        isPaused && (pausedUntil is null || clientLocalToday <= pausedUntil.Value);
}
