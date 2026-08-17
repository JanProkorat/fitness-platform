using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Loads a client's persisted IANA time zone (<see cref="Entities.ApplicationUser.TimeZone"/>)
/// and resolves it to a <see cref="TimeZoneInfo"/> via <see cref="ClientLocalDateResolver"/>.
/// </summary>
/// <remarks>
/// The load half of the placement split described in #935: this extension owns the single EF
/// query against <see cref="IApplicationDbContext.Users"/>; <see cref="ClientLocalDateResolver"/>
/// owns the pure conversion math and has no EF/Mongo dependency of its own. Matches the shape of
/// <see cref="ClientProfileLookupExtensions"/> — an endpoint extension method on
/// <see cref="IApplicationDbContext"/>.
/// </remarks>
public static class ClientLocalTimeExtensions
{
    /// <summary>
    /// Resolves the <see cref="TimeZoneInfo"/> for the given client (<c>ApplicationUser.Id</c>),
    /// falling back to UTC when the user has no persisted time zone or the id is unrecognised —
    /// see <see cref="ClientLocalDateResolver.ResolveTimeZone"/>.
    /// </summary>
    public static async Task<TimeZoneInfo> ResolveClientTimeZoneAsync(
        this IApplicationDbContext db,
        Guid clientUserId,
        CancellationToken ct)
    {
        var ianaId = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == clientUserId)
            .Select(u => u.TimeZone)
            .FirstOrDefaultAsync(ct);

        return ClientLocalDateResolver.ResolveTimeZone(ianaId);
    }

    /// <summary>
    /// Resolves the client's current local calendar date as the midnight-UTC storage value —
    /// see <see cref="ClientLocalDateResolver.ResolveLocalDateUtcMidnight"/>. Uses
    /// <see cref="DateTime.UtcNow"/> as the instant.
    /// </summary>
    public static async Task<DateTime> ResolveClientLocalDateUtcAsync(
        this IApplicationDbContext db,
        Guid clientUserId,
        CancellationToken ct)
    {
        var timeZone = await db.ResolveClientTimeZoneAsync(clientUserId, ct);
        return ClientLocalDateResolver.ResolveLocalDateUtcMidnight(DateTime.UtcNow, timeZone);
    }

    /// <summary>
    /// Resolves the client's current local calendar day both as the midnight-UTC storage value
    /// (for <c>LogDate</c>/<c>Date</c>-style fields) and as the local day's
    /// <c>[startUtc, endUtc)</c> instant window (for <c>EatenAt</c>/<c>CreatedAt</c>-style instant
    /// fields) — see <see cref="ClientLocalDateResolver.ResolveLocalDayWindowUtc"/>. Uses
    /// <see cref="DateTime.UtcNow"/> as the instant.
    /// </summary>
    public static async Task<(DateTime LocalDateUtc, DateTime WindowStartUtc, DateTime WindowEndUtc)> ResolveClientLocalDayWindowAsync(
        this IApplicationDbContext db,
        Guid clientUserId,
        CancellationToken ct)
    {
        var timeZone = await db.ResolveClientTimeZoneAsync(clientUserId, ct);
        var utcNow = DateTime.UtcNow;
        var localDate = ClientLocalDateResolver.ResolveLocalDate(utcNow, timeZone);
        var localDateUtc = localDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var (startUtc, endUtc) = ClientLocalDateResolver.ResolveLocalDayWindowUtc(localDate, timeZone);

        return (localDateUtc, startUtc, endUtc);
    }
}
