namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Billing cadence for a <see cref="Entities.SubscriptionPlan"/>.
/// </summary>
public enum BillingInterval
{
    /// <summary>Billed monthly.</summary>
    Monthly,

    /// <summary>Billed annually.</summary>
    Annual
}
