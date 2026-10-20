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
    [Fact]
    public void ComputeDueSends_SendInsideTheRange_ReturnsThePlanAnchorAndInstant()
    {
        var planId = Guid.NewGuid();
        var plan = new AutomationPlanWindow { PlanId = planId, ClientId = Guid.NewGuid(), StartDate = Utc(2026, 3, 2), WeekCount = 4 };

        var sends = AutomationPlanEventCalculator.ComputeDueSends(
            AutomationEventType.PlanStarted, 2, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
            [plan], Utc(2026, 3, 4, 8), Utc(2026, 3, 4, 10));

        sends.Should().ContainSingle().Which.Should().Be(
            new AutomationPlanSend(planId, new DateOnly(2026, 3, 2), Utc(2026, 3, 4, 9)));
    }

    [Fact]
    public void ComputeDueSends_PlanEnded_AnchorsOnTheLastDay()
    {
        var plan = new AutomationPlanWindow { PlanId = Guid.NewGuid(), ClientId = Guid.NewGuid(), StartDate = Utc(2026, 3, 2), WeekCount = 2 };

        var sends = AutomationPlanEventCalculator.ComputeDueSends(
            AutomationEventType.PlanEnded, 0, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
            [plan], Utc(2026, 3, 15), Utc(2026, 3, 15, 23));

        sends.Should().ContainSingle().Which.Anchor.Should().Be(new DateOnly(2026, 3, 15));
    }

    [Fact]
    public void ComputeDueSends_SendOutsideTheRange_ReturnsNothing()
    {
        var plan = new AutomationPlanWindow { PlanId = Guid.NewGuid(), ClientId = Guid.NewGuid(), StartDate = Utc(2026, 3, 2), WeekCount = 4 };

        AutomationPlanEventCalculator.ComputeDueSends(
                AutomationEventType.PlanStarted, 0, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
                [plan], Utc(2026, 3, 2, 9, 1), Utc(2026, 3, 3))
            .Should().BeEmpty();
    }

    [Fact]
    public void ComputeDueSends_TwoPlansSameDay_ReturnsOneSendPerPlan()
    {
        var first = new AutomationPlanWindow { PlanId = Guid.NewGuid(), ClientId = Guid.NewGuid(), StartDate = Utc(2026, 3, 2), WeekCount = 4 };
        var second = new AutomationPlanWindow { PlanId = Guid.NewGuid(), ClientId = first.ClientId, StartDate = Utc(2026, 3, 2), WeekCount = 8 };

        var sends = AutomationPlanEventCalculator.ComputeDueSends(
            AutomationEventType.PlanStarted, 0, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
            [first, second], Utc(2026, 3, 2, 9), Utc(2026, 3, 2, 9));

        sends.Select(send => send.PlanId).Should().BeEquivalentTo([first.PlanId, second.PlanId]);
    }

    [Fact]
    public void ComputeDueSends_AgreesWithComputeNextSendAt()
    {
        var plan = new AutomationPlanWindow { PlanId = Guid.NewGuid(), ClientId = Guid.NewGuid(), StartDate = Utc(2026, 3, 20), WeekCount = 3 };
        var next = AutomationPlanEventCalculator.ComputeNextSendAt(
            AutomationEventType.PlanStarted, 10, AutomationOffsetDirection.After, new TimeOnly(8, 15), Prague,
            [plan], Utc(2026, 3, 1));

        var sends = AutomationPlanEventCalculator.ComputeDueSends(
            AutomationEventType.PlanStarted, 10, AutomationOffsetDirection.After, new TimeOnly(8, 15), Prague,
            [plan], next!.Value, next.Value);

        sends.Should().ContainSingle().Which.SendAt.Should().Be(next.Value);
        next.Value.Should().Be(Utc(2026, 3, 30, 6, 15), "08:15 in Prague is 06:15 UTC once summer time has started");
    }

    [Theory]
    [InlineData(AutomationEventType.ClientJoined)]
    [InlineData(AutomationEventType.FormAnswered)]
    public void ComputeDueSends_OtherEvents_ReturnNothing(AutomationEventType eventType)
    {
        AutomationPlanEventCalculator.ComputeDueSends(
                eventType, 0, AutomationOffsetDirection.After, null, TimeZoneInfo.Utc,
                [Plan(Utc(2026, 3, 2), 4)], Utc(2026, 1, 1), Utc(2026, 12, 31))
            .Should().BeEmpty();
    }
}
