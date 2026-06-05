namespace FitnessPlatform.Application.Features.WeeklyCheckIns.PutSettings;

/// <summary>
/// Request body for PUT /trainer/weekly-check-ins/settings.
/// </summary>
public class PutSettingsRequest
{
    /// <summary>
    /// Profession this setting applies to. Must be one of the trainer's specializations.
    /// Accepted values: "Training", "Nutrition".
    /// </summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>
    /// Day of the week on which the reminder fires (0 = Sunday … 6 = Saturday).
    /// </summary>
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Local time of day for the reminder. Must be between 00:00:00 and 23:59:59.
    /// </summary>
    public TimeSpan TimeOfDay { get; set; }

    /// <summary>
    /// Whether the reminder is enabled.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Optional addendum appended to the default reminder message. ≤ 200 characters.
    /// </summary>
    public string? DefaultAddendum { get; set; }

    /// <summary>
    /// Number of hours after the check-in is sent before it expires.
    /// Must be one of: 24, 48, 72, 120, 168.
    /// Defaults to 72 (3 days) when not specified.
    /// </summary>
    public int DeadlineOffsetHours { get; set; } = 72;
}
