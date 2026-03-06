namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Constants for application role names.
/// </summary>
public static class AppRoles
{
    /// <summary>
    /// Platform administrator.
    /// </summary>
    public const string Admin = nameof(Admin);

    /// <summary>
    /// Fitness trainer.
    /// </summary>
    public const string Trainer = nameof(Trainer);

    /// <summary>
    /// Nutritionist.
    /// </summary>
    public const string Nutritionist = nameof(Nutritionist);

    /// <summary>
    /// Client.
    /// </summary>
    public const string Client = nameof(Client);

    /// <summary>
    /// Comma-separated trainer roles (Trainer, Nutritionist).
    /// </summary>
    public const string TrainerOrNutritionist = $"{Trainer},{Nutritionist}";
}
