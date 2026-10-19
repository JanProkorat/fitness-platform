using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// The part of an automation rule a coach can customise per client: message, trigger and options.
/// </summary>
public class AutomationTriggerBody
{
    /// <summary>Optional text sent with the request (at most 1000 characters).</summary>
    public string? Message { get; set; }

    /// <summary>Schedule or event trigger.</summary>
    public AutomationTriggerKind TriggerKind { get; set; }

    /// <summary>Schedule trigger: send every N units (1-365).</summary>
    public int? ScheduleInterval { get; set; }

    /// <summary>Schedule trigger: unit of the interval.</summary>
    public AutomationScheduleUnit? ScheduleUnit { get; set; }

    /// <summary>Schedule trigger: client-local time of day, from 00:00 up to 23:59.</summary>
    public TimeSpan? LocalTime { get; set; }

    /// <summary>Event trigger: the event.</summary>
    public AutomationEventType? EventType { get; set; }

    /// <summary>Event trigger: days between the event and the send; defaults to 0.</summary>
    public int? EventOffsetDays { get; set; }

    /// <summary>Event trigger: whether the offset lands before or after the event; defaults to After.</summary>
    public AutomationOffsetDirection? EventOffsetDirection { get; set; }

    /// <summary>Plan events only: fire at most once per plan.</summary>
    public bool OncePerPlan { get; set; }

    /// <summary>Skip an occurrence while the previous request is still unanswered.</summary>
    public bool SkipWhilePreviousUnanswered { get; set; } = true;

    /// <summary>Stop after this many sends per client; null means no limit.</summary>
    public int? StopAfterSends { get; set; }

    /// <summary>Whether the rule is active.</summary>
    public bool Enabled { get; set; } = true;
}
