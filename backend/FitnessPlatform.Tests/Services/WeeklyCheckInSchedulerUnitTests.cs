using FluentAssertions;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Pure unit tests for the scheduler's TZ math helpers — no Docker required.
/// </summary>
public class WeeklyCheckInSchedulerUnitTests
{
    private static readonly TimeZoneInfo Prague =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

    private static readonly TimeZoneInfo Utc = TimeZoneInfo.Utc;

    // ── ComputeNextFireAt ─────────────────────────────────────────────────────

    [Fact]
    public void ComputeNextFireAt_FireDayIsToday_TimeAlreadyPassed_ReturnsToday()
    {
        // Today (UTC) is a Wednesday, 19:00.
        // Setting: Wednesday 18:00 UTC.
        var utcNow = new DateTime(2026, 4, 22, 19, 0, 0, DateTimeKind.Utc); // Wednesday
        utcNow.DayOfWeek.Should().Be(DayOfWeek.Wednesday);

        var result = WeeklyCheckInScheduler.ComputeNextFireAt(
            DayOfWeek.Wednesday, TimeSpan.FromHours(18), Utc, utcNow);

        result.Should().Be(new DateTime(2026, 4, 22, 18, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ComputeNextFireAt_FireDayIsToday_TimeFuture_ReturnsOneWeekAgo()
    {
        // Today (UTC) is a Wednesday, 17:00.
        // Setting: Wednesday 18:00 UTC — hasn't fired yet today → step back to last Wednesday.
        var utcNow = new DateTime(2026, 4, 22, 17, 0, 0, DateTimeKind.Utc); // Wednesday
        var result = WeeklyCheckInScheduler.ComputeNextFireAt(
            DayOfWeek.Wednesday, TimeSpan.FromHours(18), Utc, utcNow);

        result.Should().Be(new DateTime(2026, 4, 15, 18, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ComputeNextFireAt_FireDayInPast_ReturnsCorrectPastDay()
    {
        // Today (UTC) is Friday. Setting is Monday 18:00 UTC.
        // Friday = day 5, Monday = day 1. 5-1 = 4 days back → Monday.
        var utcNow = new DateTime(2026, 4, 24, 20, 0, 0, DateTimeKind.Utc); // Friday
        utcNow.DayOfWeek.Should().Be(DayOfWeek.Friday);

        var result = WeeklyCheckInScheduler.ComputeNextFireAt(
            DayOfWeek.Monday, TimeSpan.FromHours(18), Utc, utcNow);

        result.Should().Be(new DateTime(2026, 4, 20, 18, 0, 0, DateTimeKind.Utc)); // previous Monday
    }

    [Fact]
    public void ComputeNextFireAt_PragueTimezone_SummerTime_ConvertsCorrectly()
    {
        // April 2026 is CEST (UTC+2). Monday 18:00 Prague = 16:00 UTC.
        // "now" is Monday 2026-04-20 17:00 UTC (= 19:00 Prague) — past the fire time.
        var utcNow = new DateTime(2026, 4, 20, 17, 0, 0, DateTimeKind.Utc); // Monday
        utcNow.DayOfWeek.Should().Be(DayOfWeek.Monday);

        var result = WeeklyCheckInScheduler.ComputeNextFireAt(
            DayOfWeek.Monday, TimeSpan.FromHours(18), Prague, utcNow);

        // Expected: Monday 2026-04-20 18:00 Prague = 16:00 UTC.
        result.Should().Be(new DateTime(2026, 4, 20, 16, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ComputeNextFireAt_PragueTimezone_SummerTime_NotYetFired_ReturnsOneWeekPrior()
    {
        // "now" is Monday 2026-04-20 15:00 UTC = 17:00 Prague — before the 18:00 fire time.
        var utcNow = new DateTime(2026, 4, 20, 15, 0, 0, DateTimeKind.Utc);

        var result = WeeklyCheckInScheduler.ComputeNextFireAt(
            DayOfWeek.Monday, TimeSpan.FromHours(18), Prague, utcNow);

        // Should return the previous Monday (2026-04-13 18:00 Prague = 16:00 UTC).
        result.Should().Be(new DateTime(2026, 4, 13, 16, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ComputeNextFireAt_SundayFire_TodayIsMonday_ReturnsSundayYesterday()
    {
        // Today is Monday 2026-04-20 12:00 UTC. Setting: Sunday 18:00 UTC.
        var utcNow = new DateTime(2026, 4, 20, 12, 0, 0, DateTimeKind.Utc); // Monday
        var result = WeeklyCheckInScheduler.ComputeNextFireAt(
            DayOfWeek.Sunday, TimeSpan.FromHours(18), Utc, utcNow);

        result.Should().Be(new DateTime(2026, 4, 19, 18, 0, 0, DateTimeKind.Utc)); // Sunday
    }

    // ── NextIsoMonday ─────────────────────────────────────────────────────────

    [Fact]
    public void NextIsoMonday_FromMonday_ReturnsMondayNextWeek()
    {
        var monday = new DateTime(2026, 4, 20); // Monday
        var result = WeeklyCheckInScheduler.NextIsoMonday(monday);
        result.Should().Be(new DateOnly(2026, 4, 27));
    }

    [Fact]
    public void NextIsoMonday_FromFriday_ReturnsMondayOfNextWeek()
    {
        var friday = new DateTime(2026, 4, 24); // Friday
        var result = WeeklyCheckInScheduler.NextIsoMonday(friday);
        result.Should().Be(new DateOnly(2026, 4, 27));
    }

    [Fact]
    public void NextIsoMonday_FromSunday_ReturnsMondayTomorrow()
    {
        var sunday = new DateTime(2026, 4, 26); // Sunday
        var result = WeeklyCheckInScheduler.NextIsoMonday(sunday);
        result.Should().Be(new DateOnly(2026, 4, 27));
    }

    [Fact]
    public void NextIsoMonday_FromSaturday_ReturnsMondayOfNextIsoWeek()
    {
        // Saturday April 25 is in ISO week April 20-26.
        // Next ISO week starts April 27.
        var saturday = new DateTime(2026, 4, 25); // Saturday
        var result = WeeklyCheckInScheduler.NextIsoMonday(saturday);
        result.Should().Be(new DateOnly(2026, 4, 27));
    }
}
