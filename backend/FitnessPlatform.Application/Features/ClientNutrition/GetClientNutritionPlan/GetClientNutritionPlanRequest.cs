namespace FitnessPlatform.Application.Features.ClientNutrition.GetClientNutritionPlan;

/// <summary>
/// Request for one of the caller's own nutrition plans by id.
/// </summary>
public class GetClientNutritionPlanRequest
{
    /// <summary>Route parameter — public id of the plan.</summary>
    public Guid PlanId { get; set; }
}
