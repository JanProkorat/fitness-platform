using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Per-client layer over a global <see cref="AutomationRule"/>: a customised copy of the rule's
/// message, trigger and options, and/or a pause. When <see cref="IsCustomized"/> is true the
/// stored fields replace the rule's own for this client. One row per (rule, client).
/// </summary>
public class AutomationClientOverride : TimestampableEntity
{
    /// <summary>Foreign key to the rule.</summary>
    public long AutomationRuleId { get; set; }

    /// <summary>Foreign key to the client.</summary>
    public long ClientProfileId { get; set; }

    /// <summary>Whether the customised fields below replace the rule's own.</summary>
    public bool IsCustomized { get; set; }

    /// <summary>Customised message.</summary>
    [MaxLength(1000)]
    public string? Message { get; set; }

    /// <summary>Customised trigger kind.</summary>
    public AutomationTriggerKind TriggerKind { get; set; }

    /// <summary>Customised schedule interval.</summary>
    public int? ScheduleInterval { get; set; }

    /// <summary>Customised schedule unit.</summary>
    public AutomationScheduleUnit? ScheduleUnit { get; set; }

    /// <summary>Customised client-local time of day.</summary>
    public TimeOnly? LocalTime { get; set; }

    /// <summary>Customised event.</summary>
    public AutomationEventType? EventType { get; set; }

    /// <summary>Customised event offset in days.</summary>
    public int? EventOffsetDays { get; set; }

    /// <summary>Customised event offset direction.</summary>
    public AutomationOffsetDirection? EventOffsetDirection { get; set; }

    /// <summary>Customised once-per-plan flag.</summary>
    public bool OncePerPlan { get; set; }

    /// <summary>Customised skip-while-unanswered flag.</summary>
    public bool SkipWhilePreviousUnanswered { get; set; } = true;

    /// <summary>Customised send limit; null means no limit.</summary>
    public int? StopAfterSends { get; set; }

    /// <summary>Customised enabled flag.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Whether the rule is paused for the client.</summary>
    public bool IsPaused { get; set; }

    /// <summary>Last client-local calendar day of the pause; null means paused until resumed.</summary>
    public DateOnly? PausedUntil { get; set; }

    /// <summary>Short coach note about the pause.</summary>
    [MaxLength(200)]
    public string? PauseNote { get; set; }

    /// <summary>Navigation to the rule.</summary>
    public AutomationRule AutomationRule { get; set; } = null!;

    /// <summary>Navigation to the client.</summary>
    public ClientProfile ClientProfile { get; set; } = null!;
}
