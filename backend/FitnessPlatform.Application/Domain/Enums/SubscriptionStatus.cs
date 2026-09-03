namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Lifecycle status of a coach's subscription.
/// </summary>
public enum SubscriptionStatus
{
    /// <summary>In an active trial period.</summary>
    Trialing,

    /// <summary>Active and in good standing.</summary>
    Active,

    /// <summary>Payment failed; grace period before cancellation.</summary>
    PastDue,

    /// <summary>The subscription has been canceled.</summary>
    Canceled,

    /// <summary>Setup did not complete (e.g. the initial payment failed).</summary>
    Incomplete
}
