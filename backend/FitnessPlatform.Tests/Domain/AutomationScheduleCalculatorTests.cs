using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Automations.Shared;
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
    [InlineData(DayOfWeek.Thursday, "UTC", "2026-01-05T12:00:00Z", "2026-01-08T18:00:00Z")] // weekday later this week
    [InlineData(DayOfWeek.Monday, "UTC", "2026-01-08T19:00:00Z", "2026-01-12T18:00:00Z")] // weekday already passed
    [InlineData(DayOfWeek.Thursday, "UTC", "2026-01-08T10:00:00Z", "2026-01-08T18:00:00Z")] // same day, before the time
    [InlineData(DayOfWeek.Thursday, "UTC", "2026-01-08T19:00:00Z", "2026-01-15T18:00:00Z")] // same day, after the time
    [InlineData(DayOfWeek.Thursday, "UTC", "2026-01-08T18:00:00Z", "2026-01-15T18:00:00Z")] // exactly now is not "after"
    [InlineData(DayOfWeek.Thursday, "Europe/Prague", "2026-01-08T16:30:00Z", "2026-01-08T17:00:00Z")] // 17:30 local, 18:00 still ahead
    [InlineData(DayOfWeek.Thursday, "Europe/Prague", "2026-01-08T17:30:00Z", "2026-01-15T17:00:00Z")] // 18:30 local, already passed
    [InlineData(DayOfWeek.Thursday, "Europe/Prague", "2026-01-07T23:30:00Z", "2026-01-08T17:00:00Z")] // already Thursday locally
    [InlineData(DayOfWeek.Thursday, "Europe/Prague", "2026-03-24T12:00:00Z", "2026-03-26T17:00:00Z")] // winter-time offset
    [InlineData(DayOfWeek.Thursday, "Europe/Prague", "2026-03-30T12:00:00Z", "2026-04-02T16:00:00Z")] // summer-time offset
    public void ComputeNextWeekdayRunAt_PicksTheNextWeekdayAtTheLocalTime(
        DayOfWeek weekday, string zoneId, string now, string expected)
    {
        var next = AutomationScheduleCalculator.ComputeNextWeekdayRunAt(
            weekday, new TimeOnly(18, 0), TimeZoneInfo.FindSystemTimeZoneById(zoneId), DateTime.Parse(now).ToUniversalTime());

        next.Should().Be(DateTime.Parse(expected).ToUniversalTime());
    }

    [Fact]
    public void ComputeNextWeekdayRunAt_LocalTimeInSpringForwardGap_MovesOneHourLater()
    {
        var next = AutomationScheduleCalculator.ComputeNextWeekdayRunAt(
            DayOfWeek.Sunday, new TimeOnly(2, 30), Prague, Utc(2026, 3, 25, 12));

        next.Should().Be(Utc(2026, 3, 29, 1, 30), "02:30 does not exist on 29 March in Prague, so 03:30 summer time is used");
    }

    [Theory]
    [InlineData("2026-01-05", "2026-01-05")]
    [InlineData("2026-01-08", "2026-01-05")]
    [InlineData("2026-01-11", "2026-01-05")]
    [InlineData("2026-01-12", "2026-01-12")]
    public void MondayOf_ReturnsTheMondayOfTheWeek(string date, string expected) =>
        AutomationScheduleCalculator.MondayOf(DateOnly.Parse(date)).Should().Be(DateOnly.Parse(expected));

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

    // A Thursday 18:00 weekly check-in in Prague: the first send waits for the first full week.

    [Theory]
    [InlineData(2026, 1, 9, 11, 0, 2026, 1, 15, 17)]   // linked on a Friday: the Monday week after
    [InlineData(2026, 1, 11, 23, 0, 2026, 1, 15, 17)]  // Monday 00:00 local counts as that week
    [InlineData(2026, 1, 11, 23, 1, 2026, 1, 22, 17)]  // a minute later is the week after
    [InlineData(2026, 3, 25, 10, 0, 2026, 4, 2, 16)]   // the week after the spring-forward Sunday, now at CEST
    [InlineData(2026, 3, 29, 22, 0, 2026, 4, 2, 16)]   // Monday 00:00 CEST, an hour after the clock change
    public void ComputeFirstFullWeekRunAt_ThursdayCheckIn_StartsWithTheFirstFullWeek(
        int year, int month, int day, int hour, int minute, int sendYear, int sendMonth, int sendDay, int sendHour)
    {
        var first = AutomationScheduleCalculator.ComputeFirstFullWeekRunAt(
            DayOfWeek.Thursday, new TimeOnly(18, 0), Prague, Utc(year, month, day, hour, minute));

        first.Should().Be(Utc(sendYear, sendMonth, sendDay, sendHour));
    }

    [Fact]
    public void ResolveFirstSendNotBefore_RuleEnabledMidWeekForAnExistingClient_SendsInTheFollowingWeek()
    {
        var effective = new AutomationEffectiveRule(
            AutomationRuleSource.Default, null, AutomationTriggerKind.Schedule, 1, AutomationScheduleUnit.Weeks,
            new TimeOnly(18, 0), null, null, null, false, false, null, true, false, null, null,
            DayOfWeek.Thursday, 48);
        var rule = new AutomationRule { Name = "Weekly check-in", DateCreated = Utc(2026, 1, 14, 10) };
        var notBefore = AutomationNextSendCalculator.ResolveFirstSendNotBefore(Utc(2025, 6, 1), rule, null);

        var next = AutomationNextSendCalculator.Compute(
            effective, Prague, new DateOnly(2025, 6, 1), [], Utc(2026, 1, 14, 10), notBefore);

        next.Should().Be(Utc(2026, 1, 22, 17), "the Thursday of the week the rule was enabled in is not a full week");
    }

    [Fact]
    public void Compute_AfterTheFirstWeek_FollowsTheWeekdayAsUsual()
    {
        var effective = new AutomationEffectiveRule(
            AutomationRuleSource.Default, null, AutomationTriggerKind.Schedule, 1, AutomationScheduleUnit.Weeks,
            new TimeOnly(18, 0), null, null, null, false, false, null, true, false, null, null,
            DayOfWeek.Thursday, 48);

        var next = AutomationNextSendCalculator.Compute(
            effective, Prague, new DateOnly(2026, 1, 9), [], Utc(2026, 1, 15, 17, 1), Utc(2026, 1, 9, 11));

        next.Should().Be(Utc(2026, 1, 22, 17));
    }

    // The first-full-week bound is EnabledAtUtc: only switching on or moving the schedule restarts it.

    private static AutomationTriggerBody Body(DayOfWeek weekday = DayOfWeek.Thursday, bool enabled = true) => new()
    {
        TriggerKind = AutomationTriggerKind.Schedule,
        ScheduleInterval = 1,
        ScheduleUnit = AutomationScheduleUnit.Weeks,
        LocalTime = TimeSpan.FromHours(18),
        ScheduleWeekday = weekday,
        AnswerWindowHours = 48,
        Enabled = enabled,
    };

    private static AutomationRule LiveRule(DateTime enabledAt)
    {
        var rule = new AutomationRule { Id = 7, Name = "Weekly check-in", DateCreated = Utc(2025, 1, 1) };
        AutomationRuleWriter.Apply(rule, Body(), isCheckIn: true, enabledAt);

        return rule;
    }

    [Fact]
    public void Apply_CreatingAnEnabledCheckInRule_SetsTheBound()
    {
        var rule = new AutomationRule { Name = "Weekly check-in" };

        AutomationRuleWriter.Apply(rule, Body(), isCheckIn: true, Utc(2026, 1, 14, 10));

        rule.EnabledAtUtc.Should().Be(Utc(2026, 1, 14, 10));
    }

    [Fact]
    public void Apply_RenameOrReminderEdit_KeepsTheBoundAndTheNextSend()
    {
        var rule = LiveRule(Utc(2026, 1, 2, 10));
        var before = AutomationNextSendCalculator.ResolveFirstSendNotBefore(Utc(2025, 6, 1), rule, null);
        var body = Body();
        body.ReminderAfterHours = 12;
        body.Message = "New wording";

        AutomationRuleWriter.Apply(rule, body, isCheckIn: true, Utc(2026, 1, 14, 10));
        rule.Name = "Renamed";

        rule.EnabledAtUtc.Should().Be(Utc(2026, 1, 2, 10));
        AutomationNextSendCalculator.ResolveFirstSendNotBefore(Utc(2025, 6, 1), rule, null).Should().Be(before);
    }

    [Fact]
    public void Apply_WeekdayChange_ResetsTheBound()
    {
        var rule = LiveRule(Utc(2026, 1, 2, 10));

        AutomationRuleWriter.Apply(rule, Body(DayOfWeek.Friday), isCheckIn: true, Utc(2026, 1, 14, 10));

        rule.EnabledAtUtc.Should().Be(Utc(2026, 1, 14, 10));
    }

    [Fact]
    public void Apply_FirstOverrideChangingOnlyTheReminder_LeavesTheBoundUnset()
    {
        var rule = LiveRule(Utc(2026, 1, 2, 10));
        var clientOverride = new AutomationClientOverride();
        var body = Body();
        body.ReminderAfterHours = 12;

        AutomationRuleWriter.Apply(clientOverride, body, isCheckIn: true, Utc(2026, 1, 14, 10), rule);

        clientOverride.EnabledAtUtc.Should().BeNull();
    }

    [Fact]
    public void Apply_FirstOverrideMovingTheWeekday_SetsTheBound()
    {
        var rule = LiveRule(Utc(2026, 1, 2, 10));
        var clientOverride = new AutomationClientOverride();

        AutomationRuleWriter.Apply(clientOverride, Body(DayOfWeek.Friday), isCheckIn: true, Utc(2026, 1, 14, 10), rule);

        clientOverride.EnabledAtUtc.Should().Be(Utc(2026, 1, 14, 10));
    }

    [Fact]
    public void Apply_SwitchingAnOverrideOn_SetsItsBoundButAnEditKeepsIt()
    {
        var clientOverride = new AutomationClientOverride { Id = 3 };
        AutomationRuleWriter.Apply(clientOverride, Body(enabled: false), isCheckIn: true, Utc(2026, 1, 2, 10));
        clientOverride.EnabledAtUtc.Should().BeNull();

        AutomationRuleWriter.Apply(clientOverride, Body(), isCheckIn: true, Utc(2026, 1, 5, 10));
        AutomationRuleWriter.Apply(clientOverride, Body(), isCheckIn: true, Utc(2026, 1, 9, 10));

        clientOverride.EnabledAtUtc.Should().Be(Utc(2026, 1, 5, 10));
    }
}
