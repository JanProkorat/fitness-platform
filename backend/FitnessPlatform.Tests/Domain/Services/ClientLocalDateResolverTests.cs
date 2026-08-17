using FluentAssertions;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// Unit tests for <see cref="ClientLocalDateResolver"/> — the per-client local-day
/// conversion introduced for #935 (client-facing "today" surfaces resolving from
/// <see cref="System.DateTime.UtcNow"/> without consulting the client's persisted time zone).
/// </summary>
public class ClientLocalDateResolverTests
{
    // ── Boundary case 1: Europe/Prague at 22:30 UTC → NEXT local day ─────────────

    [Fact]
    public void ResolveLocalDate_PragueClientAt2230Utc_ResolvesToNextLocalDay()
    {
        // 2026-06-15 22:30 UTC. Europe/Prague is UTC+2 in June (CEST) — local time is
        // 2026-06-16 00:30, the NEXT calendar day relative to the UTC date.
        var instantUtc = new DateTime(2026, 6, 15, 22, 30, 0, DateTimeKind.Utc);
        var pragueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

        var localDate = ClientLocalDateResolver.ResolveLocalDate(instantUtc, pragueTimeZone);

        localDate.Should().Be(new DateOnly(2026, 6, 16),
            "22:30 UTC is already past midnight in Europe/Prague (UTC+2 in June)");
    }

    [Fact]
    public void ResolveLocalDateUtcMidnight_PragueClientAt2230Utc_ReturnsNextDayUtcMidnight()
    {
        var instantUtc = new DateTime(2026, 6, 15, 22, 30, 0, DateTimeKind.Utc);
        var pragueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

        var result = ClientLocalDateResolver.ResolveLocalDateUtcMidnight(instantUtc, pragueTimeZone);

        result.Should().Be(new DateTime(2026, 6, 16, 0, 0, 0, DateTimeKind.Utc));
    }

    // ── Boundary case 2: America/New_York at 02:00 UTC → PREVIOUS local day ──────

    [Fact]
    public void ResolveLocalDate_NewYorkClientAt0200Utc_ResolvesToPreviousLocalDay()
    {
        // 2026-06-16 02:00 UTC. America/New_York is UTC-4 in June (EDT) — local time is
        // 2026-06-15 22:00, the PREVIOUS calendar day relative to the UTC date.
        var instantUtc = new DateTime(2026, 6, 16, 2, 0, 0, DateTimeKind.Utc);
        var newYorkTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

        var localDate = ClientLocalDateResolver.ResolveLocalDate(instantUtc, newYorkTimeZone);

        localDate.Should().Be(new DateOnly(2026, 6, 15),
            "02:00 UTC is still the previous evening in America/New_York (UTC-4 in June)");
    }

    [Fact]
    public void ResolveLocalDateUtcMidnight_NewYorkClientAt0200Utc_ReturnsPreviousDayUtcMidnight()
    {
        var instantUtc = new DateTime(2026, 6, 16, 2, 0, 0, DateTimeKind.Utc);
        var newYorkTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

        var result = ClientLocalDateResolver.ResolveLocalDateUtcMidnight(instantUtc, newYorkTimeZone);

        result.Should().Be(new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc));
    }

    // ── ResolveTimeZone fallback guards ───────────────────────────────────────────

    [Fact]
    public void ResolveTimeZone_NullIanaId_FallsBackToUtc_WithoutThrowing()
    {
        // TimeZoneInfo.FindSystemTimeZoneById(null) throws ArgumentNullException directly —
        // the short-circuit guard in ResolveTimeZone must intercept this before it ever calls it.
        var act = () => ClientLocalDateResolver.ResolveTimeZone(null);

        act.Should().NotThrow();
        ClientLocalDateResolver.ResolveTimeZone(null).Should().Be(TimeZoneInfo.Utc);
    }

    [Fact]
    public void ResolveTimeZone_WhitespaceIanaId_FallsBackToUtc()
    {
        ClientLocalDateResolver.ResolveTimeZone("   ").Should().Be(TimeZoneInfo.Utc);
    }

    [Fact]
    public void ResolveTimeZone_EmptyIanaId_FallsBackToUtc()
    {
        ClientLocalDateResolver.ResolveTimeZone(string.Empty).Should().Be(TimeZoneInfo.Utc);
    }

    [Fact]
    public void ResolveTimeZone_UnknownIanaId_FallsBackToUtc_WithoutThrowing()
    {
        var act = () => ClientLocalDateResolver.ResolveTimeZone("Not/A_Real_Zone");

        act.Should().NotThrow();
        ClientLocalDateResolver.ResolveTimeZone("Not/A_Real_Zone").Should().Be(TimeZoneInfo.Utc);
    }

    [Fact]
    public void ResolveTimeZone_ValidIanaId_ResolvesTheZone()
    {
        ClientLocalDateResolver.ResolveTimeZone("Europe/Prague").Id.Should().Be("Europe/Prague");
    }

    // ── Local-day window (EatenAt / CreatedAt instant-range filters) ─────────────

    [Fact]
    public void ResolveLocalDayWindowUtc_PragueClient_WindowStartsAtPreviousUtcDayEvening()
    {
        // Europe/Prague local midnight for 2026-06-16 is 2026-06-15 22:00 UTC (UTC+2 in June).
        var localDate = new DateOnly(2026, 6, 16);
        var pragueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

        var (startUtc, endUtc) = ClientLocalDateResolver.ResolveLocalDayWindowUtc(localDate, pragueTimeZone);

        startUtc.Should().Be(new DateTime(2026, 6, 15, 22, 0, 0, DateTimeKind.Utc));
        endUtc.Should().Be(new DateTime(2026, 6, 16, 22, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ResolveLocalDayWindowUtc_UtcClient_WindowMatchesCalendarDayExactly()
    {
        var localDate = new DateOnly(2026, 6, 16);

        var (startUtc, endUtc) = ClientLocalDateResolver.ResolveLocalDayWindowUtc(localDate, TimeZoneInfo.Utc);

        startUtc.Should().Be(new DateTime(2026, 6, 16, 0, 0, 0, DateTimeKind.Utc));
        endUtc.Should().Be(new DateTime(2026, 6, 17, 0, 0, 0, DateTimeKind.Utc));
    }

    // ── DST transition day — window computed via ConvertTimeToUtc, not a fixed offset ──

    [Fact]
    public void ResolveLocalDayWindowUtc_PragueDstSpringForwardDay_WindowIsOnly23HoursWide()
    {
        // 2026-03-29 is Europe/Prague's spring-forward day (CET→CEST at 02:00→03:00 local),
        // so the local calendar day is only 23 hours long. A fixed +1h/+2h offset would get
        // this wrong; ConvertTimeToUtc must account for the actual DST transition.
        var localDate = new DateOnly(2026, 3, 29);
        var pragueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

        var (startUtc, endUtc) = ClientLocalDateResolver.ResolveLocalDayWindowUtc(localDate, pragueTimeZone);

        (endUtc - startUtc).Should().Be(TimeSpan.FromHours(23));
    }

    [Fact]
    public void ResolveLocalDayWindowUtc_PragueDstFallBackDay_WindowIsOnly25HoursWide()
    {
        // 2026-10-25 is Europe/Prague's fall-back day (CEST→CET at 03:00→02:00 local),
        // so the local calendar day is 25 hours long.
        var localDate = new DateOnly(2026, 10, 25);
        var pragueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

        var (startUtc, endUtc) = ClientLocalDateResolver.ResolveLocalDayWindowUtc(localDate, pragueTimeZone);

        (endUtc - startUtc).Should().Be(TimeSpan.FromHours(25));
    }
}
