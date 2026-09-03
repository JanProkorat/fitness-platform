namespace FitnessPlatform.Application.Features.SubscriptionPlans.DeactivateSubscriptionPlan;

/// <summary>
/// Request model for deactivating a subscription tier.
/// </summary>
public class DeactivateSubscriptionPlanRequest
{
    /// <summary>Route-bound identifier of the plan to deactivate.</summary>
    public string Code { get; set; } = string.Empty;
}
