using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Runtime schedule of one rule for one client. Stores the next fire instant in UTC together with
/// the local time and IANA zone it was derived from, so it can be recomputed across DST changes.
/// One row per (rule, client).
/// </summary>
public class AutomationSchedule : TimestampableEntity
{
    /// <summary>Foreign key to the rule.</summary>
    public long AutomationRuleId { get; set; }

    /// <summary>Foreign key to the client.</summary>
    public long ClientProfileId { get; set; }

    /// <summary>Next fire instant (UTC); null when nothing is scheduled.</summary>
    public DateTime? NextRunAt { get; set; }

    /// <summary>Client-local time of day the schedule fires at.</summary>
    public TimeOnly LocalTime { get; set; }

    /// <summary>IANA time zone the local time is interpreted in.</summary>
    [MaxLength(64)]
    public required string TimeZoneId { get; set; }

    /// <summary>Navigation to the rule.</summary>
    public AutomationRule AutomationRule { get; set; } = null!;

    /// <summary>Navigation to the client.</summary>
    public ClientProfile ClientProfile { get; set; } = null!;
}
