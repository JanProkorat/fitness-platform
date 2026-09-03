using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.UpdateSubscriptionPlan;

/// <summary>
/// Request model for updating an existing subscription tier. <c>Code</c> is bound from the
/// route and identifies which plan to update — it is not an updatable field (immutable after
/// create; see <see cref="Domain.Entities.SubscriptionPlan.Code"/>).
/// </summary>
public class UpdateSubscriptionPlanRequest
{
    /// <summary>Route-bound identifier of the plan to update. Not itself updatable.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Czech plan name.</summary>
    public string NameCs { get; set; } = string.Empty;

    /// <summary>English plan name.</summary>
    public string NameEn { get; set; } = string.Empty;

    /// <summary>German plan name.</summary>
    public string NameDe { get; set; } = string.Empty;

    /// <summary>Which professional role(s) this plan applies to.</summary>
    public ApplicableRoles ApplicableRoles { get; set; }

    /// <summary>Whether the plan allows creating nutrition/training plans.</summary>
    public bool CanCreatePlans { get; set; }

    /// <summary>Whether the plan allows messaging clients.</summary>
    public bool CanMessage { get; set; }

    /// <summary>Whether the plan allows sending questionnaires.</summary>
    public bool CanSendQuestionnaires { get; set; }

    /// <summary>Whether the plan allows using weekly check-ins.</summary>
    public bool CanUseWeeklyCheckIns { get; set; }

    /// <summary>Whether the plan allows per-client check-in configuration.</summary>
    public bool CanUsePerClientCheckInConfig { get; set; }

    /// <summary>Maximum number of active clients allowed under this plan. Null means unlimited.</summary>
    public int? MaxActiveClients { get; set; }

    /// <summary>Plan price, expressed in the smallest unit of <see cref="Currency"/>.</summary>
    public long PriceMinorUnits { get; set; }

    /// <summary>ISO 4217 currency code for <see cref="PriceMinorUnits"/>.</summary>
    public string Currency { get; set; } = string.Empty;

    /// <summary>Billing cadence for this plan.</summary>
    public BillingInterval BillingInterval { get; set; }

    /// <summary>External payment-provider price identifier, once billing integration ships.</summary>
    public string? ExternalPriceId { get; set; }

    /// <summary>
    /// Whether the plan is currently offered/selectable. Reactivation/deactivation happens
    /// through this field — there is no separate "reactivate" endpoint.
    /// </summary>
    public bool IsActive { get; set; }
}
