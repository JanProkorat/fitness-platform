namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Primary fitness or health goal selected during onboarding.
/// </summary>
public enum PrimaryGoal
{
    /// <summary>
    /// Reduce body fat percentage.
    /// </summary>
    LoseFat,

    /// <summary>
    /// Increase lean muscle mass.
    /// </summary>
    GainMuscle,

    /// <summary>
    /// Simultaneously lose fat and gain muscle (body recomposition).
    /// </summary>
    Recomposition,

    /// <summary>
    /// Improve overall physical fitness and conditioning.
    /// </summary>
    Fitness,

    /// <summary>
    /// Improve general health and wellbeing.
    /// </summary>
    Health
}
