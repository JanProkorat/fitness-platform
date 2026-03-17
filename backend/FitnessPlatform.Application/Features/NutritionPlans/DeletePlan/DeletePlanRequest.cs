namespace FitnessPlatform.Application.Features.NutritionPlans.DeletePlan;

/// <summary>
/// Request to soft-delete (archive) a nutrition plan.
/// </summary>
public class DeletePlanRequest
{
    /// <summary>
    /// The plan's public identifier (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }
}
