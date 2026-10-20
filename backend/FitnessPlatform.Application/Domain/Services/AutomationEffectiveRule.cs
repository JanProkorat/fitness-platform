using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// A rule as one client experiences it: the rule's own fields, replaced by the client's override
/// when it is customised, plus whether a pause is in effect.
/// </summary>
/// <param name="Source">Where the row comes from.</param>
/// <param name="Message">Effective message.</param>
/// <param name="TriggerKind">Effective trigger kind.</param>
/// <param name="ScheduleInterval">Effective schedule interval.</param>
/// <param name="ScheduleUnit">Effective schedule unit.</param>
/// <param name="LocalTime">Effective client-local time of day.</param>
/// <param name="EventType">Effective event.</param>
/// <param name="EventOffsetDays">Effective event offset in days.</param>
/// <param name="EventOffsetDirection">Effective event offset direction.</param>
/// <param name="OncePerPlan">Effective once-per-plan flag.</param>
/// <param name="SkipWhilePreviousUnanswered">Effective skip-while-unanswered flag.</param>
/// <param name="StopAfterSends">Effective send limit.</param>
/// <param name="Enabled">Effective enabled flag.</param>
/// <param name="IsPaused">Whether a pause is in effect on the client's local day.</param>
/// <param name="PausedUntil">Last local day of the pause, while it is in effect.</param>
/// <param name="PauseNote">Note of the pause, while it is in effect.</param>
public sealed record AutomationEffectiveRule(
    AutomationRuleSource Source,
    string? Message,
    AutomationTriggerKind TriggerKind,
    int? ScheduleInterval,
    AutomationScheduleUnit? ScheduleUnit,
    TimeOnly? LocalTime,
    AutomationEventType? EventType,
    int? EventOffsetDays,
    AutomationOffsetDirection? EventOffsetDirection,
    bool OncePerPlan,
    bool SkipWhilePreviousUnanswered,
    int? StopAfterSends,
    bool Enabled,
    bool IsPaused,
    DateOnly? PausedUntil,
    string? PauseNote)
{
    /// <summary>Whether the effective trigger is a plan-started or plan-ended event.</summary>
    public bool IsPlanEvent =>
        TriggerKind == AutomationTriggerKind.Event &&
        EventType is AutomationEventType.PlanStarted or AutomationEventType.PlanEnded;

    /// <summary>
    /// Merges a rule with the client's override, if any. The override replaces the rule's message,
    /// trigger and options only when it is customised; a pause applies either way.
    /// </summary>
    /// <param name="rule">The rule covering the client.</param>
    /// <param name="clientOverride">The client's override of the rule, if one exists.</param>
    /// <param name="clientLocalToday">The client's current local date, which decides whether a pause lapsed.</param>
    public static AutomationEffectiveRule Resolve(
        AutomationRule rule, AutomationClientOverride? clientOverride, DateOnly clientLocalToday)
    {
        var isPaused = clientOverride is not null &&
                       AutomationScheduleCalculator.IsPauseEffective(
                           clientOverride.IsPaused, clientOverride.PausedUntil, clientLocalToday);
        var custom = clientOverride is { IsCustomized: true } ? clientOverride : null;

        var source = rule.ClientProfileId is not null ? AutomationRuleSource.OnlyThisClient
            : isPaused ? AutomationRuleSource.Paused
            : custom is not null ? AutomationRuleSource.Custom
            : AutomationRuleSource.Default;

        var pausedUntil = isPaused ? clientOverride!.PausedUntil : null;
        var pauseNote = isPaused ? clientOverride!.PauseNote : null;

        if (custom is not null)
        {
            return new AutomationEffectiveRule(
                source, custom.Message, custom.TriggerKind, custom.ScheduleInterval, custom.ScheduleUnit,
                custom.LocalTime, custom.EventType, custom.EventOffsetDays, custom.EventOffsetDirection,
                custom.OncePerPlan, custom.SkipWhilePreviousUnanswered, custom.StopAfterSends, custom.Enabled,
                isPaused, pausedUntil, pauseNote);
        }

        return new AutomationEffectiveRule(
            source, rule.Message, rule.TriggerKind, rule.ScheduleInterval, rule.ScheduleUnit,
            rule.LocalTime, rule.EventType, rule.EventOffsetDays, rule.EventOffsetDirection,
            rule.OncePerPlan, rule.SkipWhilePreviousUnanswered, rule.StopAfterSends, rule.Enabled,
            isPaused, pausedUntil, pauseNote);
    }
}
