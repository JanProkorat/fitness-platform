using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.Shared;

/// <summary>
/// Full wire representation of a <see cref="SubscriptionPlan"/> for the Admin CRUD surface —
/// reused by the list, create, and update actions (#595).
/// </summary>
public class SubscriptionPlanDto
{
    /// <summary>Stable identifier for the plan (entitlement/Stripe mapping key).</summary>
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

    /// <summary>Whether the plan is currently offered/selectable.</summary>
    public bool IsActive { get; set; }

    /// <summary>
    /// Maps a <see cref="SubscriptionPlan"/> entity to its wire representation.
    /// </summary>
    public static SubscriptionPlanDto FromEntity(SubscriptionPlan plan) => new()
    {
        Code = plan.Code,
        NameCs = plan.NameCs,
        NameEn = plan.NameEn,
        NameDe = plan.NameDe,
        ApplicableRoles = plan.ApplicableRoles,
        CanCreatePlans = plan.CanCreatePlans,
        CanMessage = plan.CanMessage,
        CanSendQuestionnaires = plan.CanSendQuestionnaires,
        CanUseWeeklyCheckIns = plan.CanUseWeeklyCheckIns,
        CanUsePerClientCheckInConfig = plan.CanUsePerClientCheckInConfig,
        MaxActiveClients = plan.MaxActiveClients,
        PriceMinorUnits = plan.PriceMinorUnits,
        Currency = plan.Currency,
        BillingInterval = plan.BillingInterval,
        ExternalPriceId = plan.ExternalPriceId,
        IsActive = plan.IsActive,
    };
}
