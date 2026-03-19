namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Type of daily occupational activity level.
/// </summary>
public enum JobType
{
    /// <summary>
    /// Desk job or other predominantly seated occupation.
    /// </summary>
    Sedentary,

    /// <summary>
    /// Job that involves prolonged standing or light movement.
    /// </summary>
    Standing,

    /// <summary>
    /// Job that involves heavy manual labour or significant physical exertion.
    /// </summary>
    Physical
}
