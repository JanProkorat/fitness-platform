namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Self-reported training frequency over the last four weeks.
/// </summary>
public enum CurrentTrainingFrequency
{
    /// <summary>
    /// No structured training sessions in the past four weeks.
    /// </summary>
    None,

    /// <summary>
    /// Occasional training; fewer than two sessions per week on average.
    /// </summary>
    Occasional,

    /// <summary>
    /// Regular training; two to three sessions per week on average.
    /// </summary>
    Regular,

    /// <summary>
    /// High frequency training; four or more sessions per week on average.
    /// </summary>
    High
}
