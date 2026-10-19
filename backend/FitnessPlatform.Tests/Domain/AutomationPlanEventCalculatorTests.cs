using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="AutomationPlanEventCalculator"/>.
/// </summary>
public class AutomationPlanEventCalculatorTests
{
    private static readonly TimeZoneInfo Prague = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

    private static DateTime Utc(int year, int month, int day, int hour = 0, int minute = 0) =>
        new(year, month, day, hour, minute, 0, DateTimeKind.Utc);

    private static AutomationPlanWindow Plan(DateTime? start, int weeks) =>
        new() { ClientId = Guid.NewGuid(), StartDate = start, WeekCount = weeks };

    [Fact]
    public void ComputeNextSendAt_PlanStartedAfterOffset_SendsOffsetDaysAfterStartAtDefaultNine()
    {
        var next = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanStarted, 2, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
            [Plan(Utc(2026, 3, 2), 4)], Utc(2026, 3, 1));

        next.Should().Be(Utc(2026, 3, 4, 9));
    }

    [Fact]
    public void ComputeNextSendAt_PlanStartedBeforeOffset_SendsOffsetDaysBeforeStart()
    {
        var next = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanStarted, 3, AutomationOffsetDirection.Before, new TimeOnly(18, 30), TimeZoneInfo.Utc,
            [Plan(Utc(2026, 3, 9), 4)], Utc(2026, 3, 1));

        next.Should().Be(Utc(2026, 3, 6, 18, 30));
    }

    [Fact]
    public void ComputeNextSendAt_PlanEnded_AnchorsOnTheLastDayOfTheWindow()
    {
        // Two weeks from Monday 2 March end on Sunday 15 March.
        var next = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanEnded, 0, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
            [Plan(Utc(2026, 3, 2), 2)], Utc(2026, 3, 1));

        next.Should().Be(Utc(2026, 3, 15, 9));
    }

    [Fact]
    public void ComputeNextSendAt_PlanEndedBeforeOffset_MovesBackFromTheLastDay()
    {
        var next = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanEnded, 2, AutomationOffsetDirection.Before, null, TimeZoneInfo.Utc,
            [Plan(Utc(2026, 3, 2), 2)], Utc(2026, 3, 1));

        next.Should().Be(Utc(2026, 3, 13, 9));
    }

    [Fact]
    public void ComputeNextSendAt_NullOffsetAndDirection_DefaultToZeroDaysAfter()
    {
        var next = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanStarted, null, null, null, TimeZoneInfo.Utc,
            [Plan(Utc(2026, 3, 2), 1)], Utc(2026, 3, 1));

        next.Should().Be(Utc(2026, 3, 2, 9));
    }

    [Fact]
    public void ComputeNextSendAt_UsesTheClientZoneAcrossTheSpringForwardChange()
    {
        // 9:00 in Prague is 08:00 UTC before the 29 March 2026 change and 07:00 UTC after it.
        var before = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanStarted, 0, AutomationOffsetDirection.After, null, Prague,
            [Plan(Utc(2026, 3, 27), 1)], Utc(2026, 3, 1));
        var after = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanStarted, 0, AutomationOffsetDirection.After, null, Prague,
            [Plan(Utc(2026, 3, 30), 1)], Utc(2026, 3, 1));

        before.Should().Be(Utc(2026, 3, 27, 8));
        after.Should().Be(Utc(2026, 3, 30, 7));
    }

    [Fact]
    public void ComputeNextSendAt_SeveralPlans_EarliestFutureOccurrenceWins()
    {
        var next = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanStarted, 0, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
            [Plan(Utc(2026, 2, 2), 4), Plan(Utc(2026, 4, 6), 4), Plan(Utc(2026, 3, 9), 4)], Utc(2026, 3, 1));

        next.Should().Be(Utc(2026, 3, 9, 9));
    }

    [Fact]
    public void ComputeNextSendAt_OccurrenceAtOrBeforeNow_IsIgnored()
    {
        AutomationPlanEventCalculator.ComputeNextSendAt(
                AutomationEventType.PlanStarted, 0, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
                [Plan(Utc(2026, 3, 2), 4)], Utc(2026, 3, 2, 9))
            .Should().BeNull();
    }

    [Fact]
    public void ComputeNextSendAt_PlanWithoutStartDate_AnchorsNothing()
    {
        AutomationPlanEventCalculator.ComputeNextSendAt(
                AutomationEventType.PlanStarted, 0, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
                [Plan(null, 4)], Utc(2026, 3, 1))
            .Should().BeNull();
    }

    [Theory]
    [InlineData(AutomationEventType.ClientJoined)]
    [InlineData(AutomationEventType.CheckInMissed)]
    [InlineData(AutomationEventType.ClientInactive)]
    [InlineData(AutomationEventType.FormAnswered)]
    public void ComputeNextSendAt_OtherEvents_HaveNoNextSend(AutomationEventType eventType)
    {
        AutomationPlanEventCalculator.ComputeNextSendAt(
                eventType, 1, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
                [Plan(Utc(2026, 3, 9), 4)], Utc(2026, 3, 1))
            .Should().BeNull();
    }
}
