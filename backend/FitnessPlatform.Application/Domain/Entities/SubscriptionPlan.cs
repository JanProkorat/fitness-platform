using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Defines a coach subscription tier: pricing, billing cadence, and the feature
/// flags/limits that <see cref="Services.EntitlementService"/> resolves against a
/// coach's active <see cref="CoachSubscription"/>.
/// </summary>
public class SubscriptionPlan : TimestampableEntity
{
    /// <summary>
    /// Stable, human-readable identifier used to reference the plan (addressed by this,
    /// not a public GUID — see #595 for the admin CRUD surface).
    /// </summary>
    public required string Code { get; set; }

    /// <summary>
    /// Czech plan name — the repo's primary/fallback locale.
    /// </summary>
    public required string NameCs { get; set; }

    /// <summary>
    /// English plan name.
    /// </summary>
    public required string NameEn { get; set; }

    /// <summary>
    /// German plan name.
    /// </summary>
    public required string NameDe { get; set; }

    /// <summary>
    /// Which professional role(s) this plan applies to.
    /// </summary>
    public ApplicableRoles ApplicableRoles { get; set; }

    /// <summary>
    /// Whether the plan allows creating nutrition/training plans.
    /// </summary>
    public bool CanCreatePlans { get; set; }

    /// <summary>
    /// Whether the plan allows messaging clients.
    /// </summary>
    public bool CanMessage { get; set; }

    /// <summary>
    /// Whether the plan allows sending questionnaires.
    /// </summary>
    public bool CanSendQuestionnaires { get; set; }

    /// <summary>
    /// Whether the plan allows using weekly check-ins.
    /// </summary>
    public bool CanUseWeeklyCheckIns { get; set; }

    /// <summary>
    /// Whether the plan allows per-client check-in configuration.
    /// </summary>
    public bool CanUsePerClientCheckInConfig { get; set; }

    /// <summary>
    /// Maximum number of active clients allowed under this plan. Null means unlimited.
    /// </summary>
    public int? MaxActiveClients { get; set; }

    /// <summary>
    /// Plan price, expressed in the smallest unit of <see cref="Currency"/> (e.g. cents).
    /// </summary>
    public long PriceMinorUnits { get; set; }

    /// <summary>
    /// ISO 4217 currency code for <see cref="PriceMinorUnits"/>.
    /// </summary>
    public required string Currency { get; set; }

    /// <summary>
    /// Billing cadence for this plan.
    /// </summary>
    public BillingInterval BillingInterval { get; set; }

    /// <summary>
    /// External payment-provider price identifier. Populated once billing integration ships.
    /// </summary>
    public string? ExternalPriceId { get; set; }

    /// <summary>
    /// Whether the plan is currently offered/selectable.
    /// </summary>
    public bool IsActive { get; set; }
}
