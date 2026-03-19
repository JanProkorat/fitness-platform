namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Prior experience with structured fitness or nutrition plans.
/// </summary>
public enum PlanExperience
{
    /// <summary>
    /// Has never followed a structured plan before.
    /// </summary>
    Never,

    /// <summary>
    /// Has tried a structured plan in the past but did not achieve the desired results.
    /// </summary>
    TriedFailed,

    /// <summary>
    /// Has tried a structured plan in the past and achieved the desired results.
    /// </summary>
    TriedSucceeded
}
