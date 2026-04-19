namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetOverrides;

/// <summary>
/// Response model for GET /trainer/weekly-check-ins/overrides.
/// </summary>
public class GetOverridesResponse
{
    /// <summary>All per-client overrides for the authenticated trainer.</summary>
    public List<CheckInOverrideDto> Overrides { get; set; } = [];
}

/// <summary>
/// DTO for a single per-client weekly check-in override.
/// Null values mean "inherit from the professional's default setting".
/// </summary>
public class CheckInOverrideDto
{
    /// <summary>Override identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>The client's ApplicationUser.Id.</summary>
    public Guid ClientUserId { get; set; }

    /// <summary>Client's first name.</summary>
    public string ClientFirstName { get; set; } = string.Empty;

    /// <summary>Client's last name.</summary>
    public string ClientLastName { get; set; } = string.Empty;

    /// <summary>Profession this override applies to ("Training" or "Nutrition").</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>Override day of week. Null = inherit.</summary>
    public int? DayOfWeek { get; set; }

    /// <summary>Override time of day. Null = inherit.</summary>
    public TimeSpan? TimeOfDay { get; set; }

    /// <summary>Override enabled flag. Null = inherit.</summary>
    public bool? Enabled { get; set; }

    /// <summary>Override addendum. Null = inherit.</summary>
    public string? Addendum { get; set; }
}
