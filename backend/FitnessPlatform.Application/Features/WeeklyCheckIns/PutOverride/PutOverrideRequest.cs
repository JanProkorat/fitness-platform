namespace FitnessPlatform.Application.Features.WeeklyCheckIns.PutOverride;

/// <summary>
/// Request model for PUT /trainer/weekly-check-ins/overrides/{clientUserId}/{profession}.
/// Route params identify the override; body provides the values (null = inherit from setting).
/// </summary>
public class PutOverrideRequest
{
    /// <summary>The client's ApplicationUser.Id (route parameter).</summary>
    public Guid ClientUserId { get; set; }

    /// <summary>Profession ("Training" or "Nutrition") (route parameter).</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>Override day of week (0 = Sunday … 6 = Saturday). Null = inherit.</summary>
    public int? DayOfWeek { get; set; }

    /// <summary>Override time of day. Null = inherit. Must be between 00:00:00 and 23:59:59 if set.</summary>
    public TimeSpan? TimeOfDay { get; set; }

    /// <summary>Override enabled flag. Null = inherit.</summary>
    public bool? Enabled { get; set; }

    /// <summary>Override addendum (≤ 200 chars). Null = inherit.</summary>
    public string? Addendum { get; set; }

    /// <summary>
    /// Override deadline offset in hours. Null = inherit from the professional's setting.
    /// When set, must be one of 24, 48, 72, 120, or 168.
    /// </summary>
    public int? DeadlineOffsetHours { get; set; }
}
