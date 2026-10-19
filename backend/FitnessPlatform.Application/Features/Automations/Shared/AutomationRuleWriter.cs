using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// Copies a validated trigger body onto a rule or a per-client override, clearing the fields that
/// do not belong to the chosen trigger kind.
/// </summary>
public static class AutomationRuleWriter
{
    /// <summary>Applies the body's message, trigger and options to a rule.</summary>
    public static void Apply(AutomationRule rule, AutomationTriggerBody body)
    {
        var isSchedule = body.TriggerKind == AutomationTriggerKind.Schedule;

        rule.Message = body.Message;
        rule.TriggerKind = body.TriggerKind;
        rule.ScheduleInterval = isSchedule ? body.ScheduleInterval : null;
        rule.ScheduleUnit = isSchedule ? body.ScheduleUnit : null;
        rule.LocalTime = isSchedule ? TimeOnly.FromTimeSpan(body.LocalTime!.Value) : null;
        rule.EventType = isSchedule ? null : body.EventType;
        rule.EventOffsetDays = isSchedule ? null : body.EventOffsetDays ?? 0;
        rule.EventOffsetDirection = isSchedule ? null : body.EventOffsetDirection ?? AutomationOffsetDirection.After;
        rule.OncePerPlan = body.OncePerPlan;
        rule.SkipWhilePreviousUnanswered = body.SkipWhilePreviousUnanswered;
        rule.StopAfterSends = body.StopAfterSends;
        rule.Enabled = body.Enabled;
    }

    /// <summary>Applies the body's message, trigger and options to a per-client override.</summary>
    public static void Apply(AutomationClientOverride clientOverride, AutomationTriggerBody body)
    {
        var isSchedule = body.TriggerKind == AutomationTriggerKind.Schedule;

        clientOverride.IsCustomized = true;
        clientOverride.Message = body.Message;
        clientOverride.TriggerKind = body.TriggerKind;
        clientOverride.ScheduleInterval = isSchedule ? body.ScheduleInterval : null;
        clientOverride.ScheduleUnit = isSchedule ? body.ScheduleUnit : null;
        clientOverride.LocalTime = isSchedule ? TimeOnly.FromTimeSpan(body.LocalTime!.Value) : null;
        clientOverride.EventType = isSchedule ? null : body.EventType;
        clientOverride.EventOffsetDays = isSchedule ? null : body.EventOffsetDays ?? 0;
        clientOverride.EventOffsetDirection = isSchedule ? null : body.EventOffsetDirection ?? AutomationOffsetDirection.After;
        clientOverride.OncePerPlan = body.OncePerPlan;
        clientOverride.SkipWhilePreviousUnanswered = body.SkipWhilePreviousUnanswered;
        clientOverride.StopAfterSends = body.StopAfterSends;
        clientOverride.Enabled = body.Enabled;
    }
}
