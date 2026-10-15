namespace FitnessPlatform.Application.Features.NutritionPlans.DeletePlan;

/// <summary>
/// Request to permanently delete a nutrition plan.
/// </summary>
public class DeletePlanRequest
{
    /// <summary>
    /// The plan's public identifier (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }
}
