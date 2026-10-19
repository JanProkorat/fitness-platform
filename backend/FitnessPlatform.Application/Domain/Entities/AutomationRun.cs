using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Log of one occurrence of a rule for one client. Unique per (rule, client, occurrence) so an
/// occurrence can never be sent twice.
/// </summary>
public class AutomationRun : TimestampableEntity
{
    /// <summary>Foreign key to the rule.</summary>
    public long AutomationRuleId { get; set; }

    /// <summary>Foreign key to the client.</summary>
    public long ClientProfileId { get; set; }

    /// <summary>Opaque key of the occurrence, e.g. the scheduled instant or an event and plan id.</summary>
    [MaxLength(100)]
    public required string Occurrence { get; set; }

    /// <summary>Outcome of the occurrence.</summary>
    public AutomationRunStatus Status { get; set; }

    /// <summary>Why the occurrence was skipped; set only when skipped.</summary>
    public AutomationSkipReason? SkipReason { get; set; }

    /// <summary>When the request was sent (UTC).</summary>
    public DateTime? SentAt { get; set; }

    /// <summary>When the client answered (UTC).</summary>
    public DateTime? AnsweredAt { get; set; }

    /// <summary>Navigation to the rule.</summary>
    public AutomationRule AutomationRule { get; set; } = null!;

    /// <summary>Navigation to the client.</summary>
    public ClientProfile ClientProfile { get; set; } = null!;
}
