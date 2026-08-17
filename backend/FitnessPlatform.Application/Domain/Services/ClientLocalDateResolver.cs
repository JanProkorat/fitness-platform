using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Resolves a client's "local calendar day" from a UTC instant and their persisted IANA time
/// zone (<see cref="Entities.ApplicationUser.TimeZone"/>). Centralises the per-user local-day
/// conversion every client-facing "today" surface needs (#935) — the pattern this generalises
/// already existed, unshared, in
/// <see cref="Infrastructure.Services.PhotoDiaryReminderScheduler"/>.
/// </summary>
/// <remarks>
/// Pure conversion math only — no EF/Mongo access here (see
/// <see cref="Extensions.ClientLocalTimeExtensions"/> for the load half of the split). Every
/// method takes the UTC instant as an explicit parameter rather than reading
/// <see cref="DateTime.UtcNow"/> itself, so callers (and tests) control the instant directly.
/// </remarks>
public static class ClientLocalDateResolver
{
    /// <summary>
    /// Resolves the <see cref="TimeZoneInfo"/> for a persisted IANA id, falling back to UTC when
    /// the id is null/blank or unrecognised. Unlike
    /// <see cref="TimeZoneInfo.FindSystemTimeZoneById(string)"/> alone, this never throws —
    /// <c>FindSystemTimeZoneById(null)</c> throws <see cref="ArgumentNullException"/>, which a
    /// bare try/catch around only <see cref="TimeZoneNotFoundException"/> /
    /// <see cref="InvalidTimeZoneException"/> would miss.
    /// </summary>
    /// <param name="ianaId">The persisted IANA time zone id (may be null/blank/unknown).</param>
    /// <param name="logger">Optional logger — a fallback due to an unrecognised id is logged as
    /// a warning when supplied.</param>
    public static TimeZoneInfo ResolveTimeZone(string? ianaId, ILogger? logger = null)
    {
        if (string.IsNullOrWhiteSpace(ianaId))
        {
            return TimeZoneInfo.Utc;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(ianaId);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            logger?.LogWarning(ex,
                "ClientLocalDateResolver: unknown time zone '{IanaId}'; falling back to UTC.", ianaId);
            return TimeZoneInfo.Utc;
        }
    }

    /// <summary>
    /// Converts a UTC instant to the client's local calendar date.
    /// </summary>
    public static DateOnly ResolveLocalDate(DateTime instantUtc, TimeZoneInfo timeZone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(instantUtc, DateTimeKind.Utc), timeZone);
        return DateOnly.FromDateTime(local);
    }

    /// <summary>
    /// Converts a UTC instant to the midnight-UTC value of the client's LOCAL calendar date —
    /// the storage convention used by <c>SessionExecution.Date</c> / <c>MealLog.LogDate</c> /
    /// <c>DayLog.LogDate</c> / <c>SessionLog.LogDate</c> (UTC midnight of the local day, not
    /// local midnight converted to a UTC instant).
    /// </summary>
    public static DateTime ResolveLocalDateUtcMidnight(DateTime instantUtc, TimeZoneInfo timeZone) =>
        ResolveLocalDate(instantUtc, timeZone).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

    /// <summary>
    /// Resolves the client's local calendar day's <c>[startUtc, endUtc)</c> instant window —
    /// used for instant-keyed range filters (e.g. <c>MealLog.EatenAt</c>, <c>DayLog.CreatedAt</c>)
    /// so a local-midnight boundary isn't skewed by the UTC offset. Computed via
    /// <see cref="TimeZoneInfo.ConvertTimeToUtc(DateTime, TimeZoneInfo)"/> rather than a fixed
    /// offset add, so it is correct across a DST transition day (a 23h or 25h local day).
    /// </summary>
    public static (DateTime StartUtc, DateTime EndUtc) ResolveLocalDayWindowUtc(DateOnly localDate, TimeZoneInfo timeZone)
    {
        var dayStart = localDate.ToDateTime(TimeOnly.MinValue);
        var dayEnd = dayStart.AddDays(1);

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(dayStart, DateTimeKind.Unspecified), timeZone);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(dayEnd, DateTimeKind.Unspecified), timeZone);

        return (startUtc, endUtc);
    }
}
