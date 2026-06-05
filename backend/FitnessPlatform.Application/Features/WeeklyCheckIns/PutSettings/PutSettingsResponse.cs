namespace FitnessPlatform.Application.Features.WeeklyCheckIns.PutSettings;

/// <summary>
/// Response for PUT /trainer/weekly-check-ins/settings.
/// </summary>
public class PutSettingsResponse
{
    /// <summary>The identifier of the created or updated setting.</summary>
    public Guid Id { get; set; }

    /// <summary>Profession this setting applies to.</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>Day of the week (0 = Sunday … 6 = Saturday).</summary>
    public int DayOfWeek { get; set; }

    /// <summary>Time of day for the reminder. Between 00:00:00 and 23:59:59.</summary>
    public TimeSpan TimeOfDay { get; set; }

    /// <summary>Whether the reminder is enabled.</summary>
    public bool Enabled { get; set; }

    /// <summary>Optional addendum.</summary>
    public string? DefaultAddendum { get; set; }

    /// <summary>Hours after dispatch before the check-in expires.</summary>
    public int DeadlineOffsetHours { get; set; }
}
