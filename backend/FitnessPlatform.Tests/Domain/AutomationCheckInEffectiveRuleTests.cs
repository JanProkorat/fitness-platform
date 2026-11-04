using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain;

/// <summary>
/// Unit tests for how a check-in rule resolves per client: the override's weekday, time and options
/// win over the rule, and a pause stops the next send.
/// </summary>
public class AutomationCheckInEffectiveRuleTests
{
    private static readonly DateTime Now = new(2026, 1, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2026, 1, 5);

    private static AutomationRule CheckInRule() => new()
    {
        Name = "Weekly check-in",
        ActionType = AutomationActionType.SendForm,
        TriggerKind = AutomationTriggerKind.Schedule,
        ScheduleInterval = 1,
        ScheduleUnit = AutomationScheduleUnit.Weeks,
        LocalTime = new TimeOnly(18, 0),
        ScheduleWeekday = DayOfWeek.Thursday,
        AnswerWindowHours = 48,
        ReminderAfterHours = 24,
        NotifyCoachOnMissedWeek = true,
        SkipWhilePreviousUnanswered = false,
    };

    private static DateTime? NextSend(AutomationEffectiveRule effective) =>
        AutomationNextSendCalculator.Compute(effective, TimeZoneInfo.Utc, Today, [], Now);

    [Fact]
    public void Resolve_RuleWithoutOverride_UsesTheRulesCheckInFields()
    {
        var effective = AutomationEffectiveRule.Resolve(CheckInRule(), null, Today);

        effective.ScheduleWeekday.Should().Be(DayOfWeek.Thursday);
        effective.AnswerWindowHours.Should().Be(48);
        effective.ReminderAfterHours.Should().Be(24);
        effective.NotifyCoachOnMissedWeek.Should().BeTrue();
        NextSend(effective).Should().Be(new DateTime(2026, 1, 8, 18, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void Resolve_CustomisedOverride_ReplacesWeekdayTimeAndOptions()
    {
        var clientOverride = new AutomationClientOverride
        {
            IsCustomized = true,
            TriggerKind = AutomationTriggerKind.Schedule,
            ScheduleInterval = 1,
            ScheduleUnit = AutomationScheduleUnit.Weeks,
            LocalTime = new TimeOnly(7, 0),
            ScheduleWeekday = DayOfWeek.Monday,
            AnswerWindowHours = 48,
            ReminderAfterHours = null,
            NotifyCoachOnMissedWeek = false,
            SkipWhilePreviousUnanswered = false,
        };

        var effective = AutomationEffectiveRule.Resolve(CheckInRule(), clientOverride, Today);

        effective.ScheduleWeekday.Should().Be(DayOfWeek.Monday);
        effective.ReminderAfterHours.Should().BeNull();
        effective.NotifyCoachOnMissedWeek.Should().BeFalse();
        NextSend(effective).Should().Be(new DateTime(2026, 1, 12, 7, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void Resolve_PausedClient_HasNoNextSend()
    {
        var clientOverride = new AutomationClientOverride { IsPaused = true };

        var effective = AutomationEffectiveRule.Resolve(CheckInRule(), clientOverride, Today);

        effective.IsPaused.Should().BeTrue();
        NextSend(effective).Should().BeNull();
    }
}
