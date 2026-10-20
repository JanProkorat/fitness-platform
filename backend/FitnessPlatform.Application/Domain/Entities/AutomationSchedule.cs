using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Runtime schedule of one rule for one client: the next fire instant in UTC. The worker recomputes it
/// from the rule and the client's current zone, so it follows DST and zone changes. One row per (rule, client).
/// </summary>
public class AutomationSchedule : TimestampableEntity
{
    /// <summary>Foreign key to the rule.</summary>
    public long AutomationRuleId { get; set; }

    /// <summary>Foreign key to the client.</summary>
    public long ClientProfileId { get; set; }

    /// <summary>Next fire instant (UTC); null when nothing is scheduled.</summary>
    public DateTime? NextRunAt { get; set; }

    /// <summary>Local time of day the last computation used; for diagnosis only, the worker recomputes it from the rule.</summary>
    public TimeOnly LocalTime { get; set; }

    /// <summary>IANA zone the last computation used; for diagnosis only, the worker uses the client's current zone.</summary>
    [MaxLength(64)]
    public required string TimeZoneId { get; set; }

    /// <summary>Navigation to the rule.</summary>
    public AutomationRule AutomationRule { get; set; } = null!;

    /// <summary>Navigation to the client.</summary>
    public ClientProfile ClientProfile { get; set; } = null!;
}
