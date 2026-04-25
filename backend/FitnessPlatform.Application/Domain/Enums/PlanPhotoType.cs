namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Identifies whether a <see cref="Entities.PlanPhoto"/> is associated with a nutrition plan or a training plan.
/// </summary>
public enum PlanPhotoType
{
    /// <summary>Nutrition plan context.</summary>
    Nutrition,

    /// <summary>Training plan context.</summary>
    Training,
}
