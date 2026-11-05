using FormUp.Application.Features.SubscriptionPlans.Shared;

namespace FormUp.Application.Features.SubscriptionPlans.GetSubscriptionPlans;

/// <summary>
/// Response for listing every subscription tier.
/// </summary>
public class GetSubscriptionPlansResponse
{
    /// <summary>All subscription plans, including inactive ones.</summary>
    public List<SubscriptionPlanDto> Plans { get; set; } = [];
}
