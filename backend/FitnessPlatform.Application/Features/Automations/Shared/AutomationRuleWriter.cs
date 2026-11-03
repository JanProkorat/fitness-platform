using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// Copies a validated trigger body onto a rule or a per-client override, clearing the fields that
/// do not belong to the chosen trigger kind. The local time is kept for both kinds; an event rule may
/// leave it empty.
/// </summary>
public static class AutomationRuleWriter
{
    /// <summary>
    /// Applies the body's message, trigger and options to a rule. A check-in rule never skips while the
    /// previous request is unanswered, whatever the body says.
    /// </summary>
    public static void Apply(AutomationRule rule, AutomationTriggerBody body, bool isCheckIn = false, DateTime? nowUtc = null)
    {
        var isSchedule = body.TriggerKind == AutomationTriggerKind.Schedule;
        var wasEnabled = rule.Id != 0 && rule.Enabled;
        var scheduleChanged = rule.ScheduleWeekday != (isCheckIn ? body.ScheduleWeekday : null)
                              || rule.LocalTime != (body.LocalTime is { } time ? TimeOnly.FromTimeSpan(time) : null);

        rule.Message = body.Message;
        rule.TriggerKind = body.TriggerKind;
        rule.ScheduleInterval = isSchedule ? body.ScheduleInterval : null;
        rule.ScheduleUnit = isSchedule ? body.ScheduleUnit : null;
        rule.LocalTime = body.LocalTime is { } localTime ? TimeOnly.FromTimeSpan(localTime) : null;
        rule.EventType = isSchedule ? null : body.EventType;
        rule.EventOffsetDays = isSchedule ? null : body.EventOffsetDays ?? 0;
        rule.EventOffsetDirection = isSchedule ? null : body.EventOffsetDirection ?? AutomationOffsetDirection.After;
        rule.OncePerPlan = body.OncePerPlan;
        rule.SkipWhilePreviousUnanswered = body.SkipWhilePreviousUnanswered && !isCheckIn;
        rule.StopAfterSends = body.StopAfterSends;
        rule.Enabled = body.Enabled;
        rule.ScheduleWeekday = isCheckIn ? body.ScheduleWeekday : null;
        rule.AnswerWindowHours = isCheckIn ? body.AnswerWindowHours : null;
        rule.ReminderAfterHours = isCheckIn ? body.ReminderAfterHours : null;
        rule.NotifyCoachOnMissedWeek = isCheckIn ? body.NotifyCoachOnMissedWeek ?? false : null;

        // Only switching on or moving the schedule restarts the first-full-week bound; other edits keep it.
        if (rule.Enabled && (!wasEnabled || scheduleChanged))
        {
            rule.EnabledAtUtc = nowUtc ?? DateTime.UtcNow;
        }
    }

    /// <summary>
    /// Applies the body's message, trigger and options to a per-client override. A check-in rule never
    /// skips while the previous request is unanswered, whatever the body says. The first override of a
    /// client is compared with <paramref name="parentRule"/>, the schedule the client followed until now.
    /// </summary>
    public static void Apply(
        AutomationClientOverride clientOverride,
        AutomationTriggerBody body,
        bool isCheckIn = false,
        DateTime? nowUtc = null,
        AutomationRule? parentRule = null)
    {
        var isSchedule = body.TriggerKind == AutomationTriggerKind.Schedule;
        var baseline = !clientOverride.IsCustomized && parentRule is not null;
        var wasEnabled = baseline
            ? parentRule!.Enabled && !clientOverride.IsPaused
            : clientOverride.Id != 0 && clientOverride.IsCustomized && clientOverride.Enabled;
        var baselineWeekday = baseline ? parentRule!.ScheduleWeekday : clientOverride.ScheduleWeekday;
        var baselineTime = baseline ? parentRule!.LocalTime : clientOverride.LocalTime;
        var scheduleChanged = baselineWeekday != (isCheckIn ? body.ScheduleWeekday : null)
                              || baselineTime != (body.LocalTime is { } time ? TimeOnly.FromTimeSpan(time) : null);

        clientOverride.IsCustomized = true;
        clientOverride.Message = body.Message;
        clientOverride.TriggerKind = body.TriggerKind;
        clientOverride.ScheduleInterval = isSchedule ? body.ScheduleInterval : null;
        clientOverride.ScheduleUnit = isSchedule ? body.ScheduleUnit : null;
        clientOverride.LocalTime = body.LocalTime is { } localTime ? TimeOnly.FromTimeSpan(localTime) : null;
        clientOverride.EventType = isSchedule ? null : body.EventType;
        clientOverride.EventOffsetDays = isSchedule ? null : body.EventOffsetDays ?? 0;
        clientOverride.EventOffsetDirection = isSchedule ? null : body.EventOffsetDirection ?? AutomationOffsetDirection.After;
        clientOverride.OncePerPlan = body.OncePerPlan;
        clientOverride.SkipWhilePreviousUnanswered = body.SkipWhilePreviousUnanswered && !isCheckIn;
        clientOverride.StopAfterSends = body.StopAfterSends;
        clientOverride.Enabled = body.Enabled;
        clientOverride.ScheduleWeekday = isCheckIn ? body.ScheduleWeekday : null;
        clientOverride.AnswerWindowHours = isCheckIn ? body.AnswerWindowHours : null;
        clientOverride.ReminderAfterHours = isCheckIn ? body.ReminderAfterHours : null;
        clientOverride.NotifyCoachOnMissedWeek = isCheckIn ? body.NotifyCoachOnMissedWeek ?? false : null;

        if (clientOverride.Enabled && (!wasEnabled || scheduleChanged))
        {
            clientOverride.EnabledAtUtc = nowUtc ?? DateTime.UtcNow;
        }
    }
}
