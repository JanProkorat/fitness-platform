namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Status of a nutrition plan.
/// </summary>
public enum NutritionPlanStatus
{
    /// <summary>
    /// Plan is being edited and not yet visible to the client.
    /// </summary>
    Draft,

    /// <summary>
    /// Plan is published and active for the client.
    /// </summary>
    Active,

    /// <summary>
    /// Plan is no longer in use (soft-deleted).
    /// </summary>
    Archived
}
