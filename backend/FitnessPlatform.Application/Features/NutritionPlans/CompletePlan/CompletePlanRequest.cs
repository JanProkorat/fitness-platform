namespace FitnessPlatform.Application.Features.NutritionPlans.CompletePlan;

/// <summary>
/// Request to mark a nutrition plan as completed.
/// </summary>
public class CompletePlanRequest
{
    /// <summary>Plan identifier.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Optimistic concurrency version.</summary>
    public int Version { get; set; }
}
