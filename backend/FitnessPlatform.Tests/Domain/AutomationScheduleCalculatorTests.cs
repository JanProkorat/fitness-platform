using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="AutomationScheduleCalculator"/>.
/// </summary>
public class AutomationScheduleCalculatorTests
{
    private static readonly TimeZoneInfo Prague = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

    private static DateTime Utc(int year, int month, int day, int hour = 0, int minute = 0) =>
        new(year, month, day, hour, minute, 0, DateTimeKind.Utc);

    [Fact]
    public void ComputeNextRunAt_EveryTwoWeeks_FirstOccurrenceIsOneIntervalAfterStart()
    {
        var next = AutomationScheduleCalculator.ComputeNextRunAt(
            2, AutomationScheduleUnit.Weeks, new TimeOnly(9, 0), TimeZoneInfo.Utc,
            new DateOnly(2026, 1, 5), Utc(2026, 1, 6));

        next.Should().Be(Utc(2026, 1, 19, 9));
    }

    [Fact]
    public void ComputeNextRunAt_NowEqualsAnOccurrence_ReturnsTheFollowingOne()
    {
        var next = AutomationScheduleCalculator.ComputeNextRunAt(
            3, AutomationScheduleUnit.Days, new TimeOnly(9, 0), TimeZoneInfo.Utc,
            new DateOnly(2026, 1, 1), Utc(2026, 1, 4, 9));

        next.Should().Be(Utc(2026, 1, 7, 9));
    }

    [Fact]
    public void ComputeNextRunAt_NowBeforeFirstOccurrence_ReturnsFirstOccurrence()
    {
        var next = AutomationScheduleCalculator.ComputeNextRunAt(
            3, AutomationScheduleUnit.Days, new TimeOnly(9, 0), TimeZoneInfo.Utc,
            new DateOnly(2026, 1, 1), Utc(2026, 1, 1, 8));

        next.Should().Be(Utc(2026, 1, 4, 9));
    }

    [Fact]
    public void ComputeNextRunAt_AcrossSpringForward_KeepsTheLocalTime()
    {
        var next = AutomationScheduleCalculator.ComputeNextRunAt(
            1, AutomationScheduleUnit.Weeks, new TimeOnly(9, 0), Prague,
            new DateOnly(2026, 3, 20), Utc(2026, 3, 28));

        next.Should().Be(Utc(2026, 4, 3, 7), "09:00 in Prague is 07:00 UTC once summer time has started");
    }

    [Fact]
    public void ComputeNextRunAt_LocalTimeInSpringForwardGap_MovesOneHourLater()
    {
        var next = AutomationScheduleCalculator.ComputeNextRunAt(
            1, AutomationScheduleUnit.Days, new TimeOnly(2, 30), Prague,
            new DateOnly(2026, 3, 28), Utc(2026, 3, 28, 12));

        next.Should().Be(Utc(2026, 3, 29, 1, 30), "02:30 does not exist on 29 March in Prague, so 03:30 summer time is used");
    }

    [Fact]
    public void ComputeNextRunAt_AcrossFallBack_KeepsTheLocalTime()
    {
        var next = AutomationScheduleCalculator.ComputeNextRunAt(
            1, AutomationScheduleUnit.Weeks, new TimeOnly(9, 0), Prague,
            new DateOnly(2026, 10, 16), Utc(2026, 10, 24));

        next.Should().Be(Utc(2026, 10, 30, 8), "09:00 in Prague is 08:00 UTC again once winter time has started");
    }

    [Fact]
    public void ComputeNextRunAt_LocalTimeInFallBackOverlap_UsesTheStandardTimeInstant()
    {
        var next = AutomationScheduleCalculator.ComputeNextRunAt(
            1, AutomationScheduleUnit.Days, new TimeOnly(2, 30), Prague,
            new DateOnly(2026, 10, 24), Utc(2026, 10, 24, 12));

        next.Should().Be(Utc(2026, 10, 25, 1, 30), "02:30 happens twice on 25 October in Prague; the later, winter-time one is used");
    }

    [Fact]
    public void ComputeNextRunAt_DayAfterSpringForward_IsOneHourEarlierInUtcThanTheDayBefore()
    {
        var before = AutomationScheduleCalculator.ComputeNextRunAt(
            1, AutomationScheduleUnit.Days, new TimeOnly(9, 0), Prague,
            new DateOnly(2026, 3, 27), Utc(2026, 3, 27, 12));
        var after = AutomationScheduleCalculator.ComputeNextRunAt(
            1, AutomationScheduleUnit.Days, new TimeOnly(9, 0), Prague,
            new DateOnly(2026, 3, 28), Utc(2026, 3, 28, 12));

        before.Should().Be(Utc(2026, 3, 28, 8));
        after.Should().Be(Utc(2026, 3, 29, 7));
    }

    [Fact]
    public void ComputeNextRunAt_IntervalBelowOne_ReturnsNull()
    {
        AutomationScheduleCalculator.ComputeNextRunAt(
                0, AutomationScheduleUnit.Days, new TimeOnly(9, 0), TimeZoneInfo.Utc,
                new DateOnly(2026, 1, 1), Utc(2026, 1, 2))
            .Should().BeNull();
    }

    [Theory]
    [InlineData(false, null, false)]
    [InlineData(true, null, true)]
    [InlineData(true, "2026-05-10", true)]
    [InlineData(true, "2026-05-09", false)]
    public void IsPauseEffective_LapsesAfterTheEndDate(bool isPaused, string? pausedUntil, bool expected)
    {
        var until = pausedUntil is null ? (DateOnly?)null : DateOnly.Parse(pausedUntil);

        AutomationScheduleCalculator.IsPauseEffective(isPaused, until, new DateOnly(2026, 5, 10))
            .Should().Be(expected);
    }
}
