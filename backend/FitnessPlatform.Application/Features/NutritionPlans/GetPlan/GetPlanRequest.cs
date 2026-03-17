namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlan;

/// <summary>
/// Request to retrieve a single nutrition plan by its public identifier.
/// </summary>
public class GetPlanRequest
{
    /// <summary>
    /// The plan's public identifier (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }
}
