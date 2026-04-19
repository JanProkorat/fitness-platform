namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetSettings;

/// <summary>
/// Response model for GET /trainer/weekly-check-ins/settings.
/// </summary>
public class GetSettingsResponse
{
    /// <summary>The trainer's current weekly check-in settings (0–2 items).</summary>
    public List<CheckInSettingDto> Settings { get; set; } = [];
}

/// <summary>
/// DTO for a single weekly check-in setting.
/// </summary>
public class CheckInSettingDto
{
    /// <summary>Setting identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>Profession this setting applies to ("Training" or "Nutrition").</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>Day of the week (0 = Sunday, 1 = Monday, …, 6 = Saturday).</summary>
    public int DayOfWeek { get; set; }

    /// <summary>Hour-aligned time of day in "HH:mm:ss" format.</summary>
    public TimeSpan TimeOfDay { get; set; }

    /// <summary>Whether the reminder is enabled.</summary>
    public bool Enabled { get; set; }

    /// <summary>Optional addendum appended to the default reminder message.</summary>
    public string? DefaultAddendum { get; set; }
}
