namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// The client's nutrition goal, used to calculate caloric adjustment.
/// </summary>
public enum NutritionGoal
{
    /// <summary>
    /// Weight loss — 20% caloric deficit.
    /// </summary>
    Cut,

    /// <summary>
    /// Maintenance — no caloric adjustment.
    /// </summary>
    Maintain,

    /// <summary>
    /// Muscle gain — 10% caloric surplus.
    /// </summary>
    Bulk
}
