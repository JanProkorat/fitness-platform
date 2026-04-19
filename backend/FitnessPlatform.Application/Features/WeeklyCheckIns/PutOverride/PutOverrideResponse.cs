namespace FitnessPlatform.Application.Features.WeeklyCheckIns.PutOverride;

/// <summary>
/// Response for PUT /trainer/weekly-check-ins/overrides/{clientUserId}/{profession}.
/// </summary>
public class PutOverrideResponse
{
    /// <summary>Override identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>The client's ApplicationUser.Id.</summary>
    public Guid ClientUserId { get; set; }

    /// <summary>Profession this override applies to.</summary>
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
