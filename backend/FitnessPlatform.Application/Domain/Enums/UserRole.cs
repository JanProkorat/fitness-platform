namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Defines the available roles within the fitness platform.
/// </summary>
public enum UserRole
{
    /// <summary>
    /// Platform administrator with full access.
    /// </summary>
    Admin,

    /// <summary>
    /// Fitness trainer who manages client workouts.
    /// </summary>
    Trainer,

    /// <summary>
    /// Nutritionist who manages client meal plans.
    /// </summary>
    Nutritionist,

    /// <summary>
    /// Client who receives training and/or nutrition guidance.
    /// </summary>
    Client
}
