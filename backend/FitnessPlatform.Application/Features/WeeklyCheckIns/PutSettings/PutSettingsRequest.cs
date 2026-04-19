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
    /// Hour-aligned local time of day for the reminder. Minutes, Seconds, and Milliseconds must all be zero.
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
}
