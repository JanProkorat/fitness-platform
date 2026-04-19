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

    /// <summary>Hour-aligned time of day.</summary>
    public TimeSpan TimeOfDay { get; set; }

    /// <summary>Whether the reminder is enabled.</summary>
    public bool Enabled { get; set; }

    /// <summary>Optional addendum.</summary>
    public string? DefaultAddendum { get; set; }
}
