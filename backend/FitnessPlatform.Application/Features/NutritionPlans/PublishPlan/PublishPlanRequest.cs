namespace FitnessPlatform.Application.Features.NutritionPlans.PublishPlan;

/// <summary>
/// Request to publish a nutrition plan, making it active for the client.
/// </summary>
public class PublishPlanRequest
{
    /// <summary>
    /// The plan's public identifier (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }
}
