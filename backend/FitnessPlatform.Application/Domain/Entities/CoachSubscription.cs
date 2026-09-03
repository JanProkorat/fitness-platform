using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Tracks a single professional's subscription to a <see cref="SubscriptionPlan"/>.
/// At most one row exists per <see cref="ProfessionalProfileId"/>.
/// </summary>
public class CoachSubscription : TimestampableEntity
{
    /// <summary>
    /// The professional this subscription belongs to. Unique — a professional has
    /// zero or one subscription.
    /// </summary>
    public required long ProfessionalProfileId { get; set; }

    /// <summary>
    /// Navigation property to the professional this subscription belongs to.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;

    /// <summary>
    /// Foreign key to the plan this subscription is currently on.
    /// </summary>
    public required long SubscriptionPlanId { get; set; }

    /// <summary>
    /// Navigation property to the plan this subscription is currently on.
    /// </summary>
    public SubscriptionPlan SubscriptionPlan { get; set; } = null!;

    /// <summary>
    /// Current lifecycle status of the subscription.
    /// </summary>
    public SubscriptionStatus Status { get; set; }

    /// <summary>
    /// When the trial period ends, if the subscription started as a trial.
    /// </summary>
    public DateTimeOffset? TrialEndsAt { get; set; }

    /// <summary>
    /// When the current billing period ends.
    /// </summary>
    public DateTimeOffset? CurrentPeriodEndsAt { get; set; }

    /// <summary>
    /// External payment-provider customer identifier.
    /// </summary>
    public string? ExternalCustomerId { get; set; }

    /// <summary>
    /// External payment-provider subscription identifier.
    /// </summary>
    public string? ExternalSubscriptionId { get; set; }
}
