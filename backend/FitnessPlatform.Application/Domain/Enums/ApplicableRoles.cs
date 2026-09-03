namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Which professional role(s) a <see cref="Entities.SubscriptionPlan"/> applies to.
/// </summary>
public enum ApplicableRoles
{
    /// <summary>Applies to trainers only.</summary>
    Trainer,

    /// <summary>Applies to nutritionists only.</summary>
    Nutritionist,

    /// <summary>Applies to both trainers and nutritionists.</summary>
    Both
}
