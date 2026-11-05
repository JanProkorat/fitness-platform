using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Services;

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
    /// Computes the next fire instant (UTC) strictly after <paramref name="nowUtc"/> of a weekly rule
    /// anchored to a weekday: the next <paramref name="weekday"/> at <paramref name="localTime"/> in
    /// <paramref name="zone"/>.
    /// </summary>
    /// <param name="weekday">Client-local weekday of the send.</param>
    /// <param name="localTime">Client-local time of day.</param>
    /// <param name="zone">The client's time zone.</param>
    /// <param name="nowUtc">The current instant.</param>
    public static DateTime ComputeNextWeekdayRunAt(
        DayOfWeek weekday, TimeOnly localTime, TimeZoneInfo zone, DateTime nowUtc)
    {
        var localToday = ClientLocalDateResolver.ResolveLocalDate(nowUtc, zone);
        var daysAhead = ((int)weekday - (int)localToday.DayOfWeek + 7) % 7;
        var candidate = ToUtc(localToday.AddDays(daysAhead), localTime, zone);

        while (candidate <= nowUtc)
        {
            daysAhead += 7;
            candidate = ToUtc(localToday.AddDays(daysAhead), localTime, zone);
        }

        return candidate;
    }

    /// <summary>
    /// The first weekly run of a rule anchored to a weekday that falls in a full week: the week of the
    /// first Monday (client-local) that is on or after <paramref name="notBeforeUtc"/>. A moment exactly
    /// at local Monday 00:00 counts as that week.
    /// </summary>
    /// <param name="weekday">Client-local weekday of the send.</param>
    /// <param name="localTime">Client-local time of day.</param>
    /// <param name="zone">The client's time zone.</param>
    /// <param name="notBeforeUtc">The moment the first week may not start before.</param>
    public static DateTime ComputeFirstFullWeekRunAt(
        DayOfWeek weekday, TimeOnly localTime, TimeZoneInfo zone, DateTime notBeforeUtc)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(notBeforeUtc, DateTimeKind.Utc), zone);
        var localDate = DateOnly.FromDateTime(local);
        var monday = MondayOf(localDate);

        if (monday != localDate || local.TimeOfDay > TimeSpan.Zero)
        {
            monday = monday.AddDays(7);
        }

        return ToUtc(monday.AddDays(((int)weekday + 6) % 7), localTime, zone);
    }

    /// <summary>
    /// The Monday of the week that contains <paramref name="localDate"/>.
    /// </summary>
    /// <param name="localDate">A calendar date.</param>
    public static DateOnly MondayOf(DateOnly localDate) =>
        localDate.AddDays(-(((int)localDate.DayOfWeek + 6) % 7));

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
