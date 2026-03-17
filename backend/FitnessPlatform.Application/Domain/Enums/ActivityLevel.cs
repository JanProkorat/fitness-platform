namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Physical activity level for TDEE calculation.
/// </summary>
public enum ActivityLevel
{
    /// <summary>
    /// Little to no exercise (factor 1.2).
    /// </summary>
    Sedentary,

    /// <summary>
    /// Light exercise 1-3 days/week (factor 1.375).
    /// </summary>
    LightlyActive,

    /// <summary>
    /// Moderate exercise 3-5 days/week (factor 1.55).
    /// </summary>
    ModeratelyActive,

    /// <summary>
    /// Hard exercise 6-7 days/week (factor 1.725).
    /// </summary>
    VeryActive,

    /// <summary>
    /// Very hard exercise, physical job (factor 1.9).
    /// </summary>
    ExtremelyActive
}
