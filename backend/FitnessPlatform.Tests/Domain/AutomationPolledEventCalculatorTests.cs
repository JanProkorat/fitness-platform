using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="AutomationPolledEventCalculator"/>.
/// </summary>
public class AutomationPolledEventCalculatorTests
{
    private static readonly TimeZoneInfo Prague = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

    private static DateTime Utc(int year, int month, int day, int hour = 0, int minute = 0) =>
        new(year, month, day, hour, minute, 0, DateTimeKind.Utc);

    [Fact]
    public void ComputeFireAt_OffsetDaysAfter_SendsAtTheLocalTimeThatManyDaysLater()
    {
        var fireAt = AutomationPolledEventCalculator.ComputeFireAt(Utc(2026, 5, 4, 14), 2, new TimeOnly(10, 0), TimeZoneInfo.Utc);

        fireAt.Should().Be(Utc(2026, 5, 6, 10));
    }

    [Fact]
    public void ComputeFireAt_NoTimeGiven_DefaultsToNineClientTime()
    {
        var fireAt = AutomationPolledEventCalculator.ComputeFireAt(Utc(2026, 5, 4, 14), 1, null, Prague);

        fireAt.Should().Be(Utc(2026, 5, 5, 7), "09:00 in Prague is 07:00 UTC in May");
    }

    [Fact]
    public void ComputeFireAt_NoOffsetAndSendTimeAlreadyPassed_MovesToTheNextDay()
    {
        var fireAt = AutomationPolledEventCalculator.ComputeFireAt(Utc(2026, 5, 4, 14), 0, new TimeOnly(9, 0), TimeZoneInfo.Utc);

        fireAt.Should().Be(Utc(2026, 5, 5, 9), "a send never precedes the event it reacts to");
    }

    [Fact]
    public void ComputeFireAt_NoOffsetAndSendTimeStillAhead_SendsTheSameDay()
    {
        var fireAt = AutomationPolledEventCalculator.ComputeFireAt(Utc(2026, 5, 4, 6), 0, new TimeOnly(9, 0), TimeZoneInfo.Utc);

        fireAt.Should().Be(Utc(2026, 5, 4, 9));
    }

    [Fact]
    public void ComputeFireAt_UsesTheClientsLocalDateOfTheEvent()
    {
        // 23:30 UTC on 4 May is already 5 May, 01:30 in Prague.
        var fireAt = AutomationPolledEventCalculator.ComputeFireAt(Utc(2026, 5, 4, 23, 30), 1, new TimeOnly(9, 0), Prague);

        fireAt.Should().Be(Utc(2026, 5, 6, 7));
    }

    [Fact]
    public void ComputeFireAt_AcrossSpringForward_KeepsTheLocalTime()
    {
        var fireAt = AutomationPolledEventCalculator.ComputeFireAt(Utc(2026, 3, 27, 12), 3, new TimeOnly(9, 0), Prague);

        fireAt.Should().Be(Utc(2026, 3, 30, 7), "09:00 in Prague is 07:00 UTC once summer time has started");
    }

    [Fact]
    public void ComputeFireAt_AcrossFallBack_KeepsTheLocalTime()
    {
        var fireAt = AutomationPolledEventCalculator.ComputeFireAt(Utc(2026, 10, 23, 12), 3, new TimeOnly(9, 0), Prague);

        fireAt.Should().Be(Utc(2026, 10, 26, 8), "09:00 in Prague is 08:00 UTC again once winter time has started");
    }

    [Theory]
    [InlineData(3, AutomationOffsetDirection.After, 3)]
    [InlineData(3, AutomationOffsetDirection.Before, 0)]
    [InlineData(null, null, 0)]
    [InlineData(-2, AutomationOffsetDirection.After, 0)]
    public void ShiftDays_AnEventAlreadyHappened_NeverMovesTheSendAheadOfIt(
        int? offsetDays, AutomationOffsetDirection? direction, int expected)
    {
        AutomationPolledEventCalculator.ShiftDays(offsetDays, direction).Should().Be(expected);
    }

    [Theory]
    [InlineData(AutomationEventType.ClientJoined, true)]
    [InlineData(AutomationEventType.CheckInMissed, true)]
    [InlineData(AutomationEventType.ClientInactive, true)]
    [InlineData(AutomationEventType.FormAnswered, true)]
    [InlineData(AutomationEventType.PlanStarted, false)]
    [InlineData(AutomationEventType.PlanEnded, false)]
    public void IsPolled_OnlyTheFourPolledEvents(AutomationEventType eventType, bool expected)
    {
        AutomationPolledEventCalculator.IsPolled(eventType).Should().Be(expected);
    }
}
