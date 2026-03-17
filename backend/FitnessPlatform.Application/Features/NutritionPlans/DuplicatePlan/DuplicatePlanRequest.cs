namespace FitnessPlatform.Application.Features.NutritionPlans.DuplicatePlan;

/// <summary>
/// Request to duplicate an existing nutrition plan.
/// </summary>
public class DuplicatePlanRequest
{
    /// <summary>
    /// The plan's public identifier to duplicate (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Optional name for the duplicated plan. Defaults to "{original name} (Copy)".
    /// </summary>
    public string? Name { get; set; }
}
