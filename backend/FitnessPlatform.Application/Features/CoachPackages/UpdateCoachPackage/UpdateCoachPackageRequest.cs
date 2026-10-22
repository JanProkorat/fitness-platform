using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.CoachPackages.Shared;

namespace FitnessPlatform.Application.Features.CoachPackages.UpdateCoachPackage;

/// <summary>
/// Request for updating a coach package. A changed price takes effect for billing periods starting from now on.
/// </summary>
public class UpdateCoachPackageRequest : ICoachPackageInput
{
    /// <summary>Route parameter — public id of the package.</summary>
    public Guid PackageId { get; set; }

    /// <summary>Display name (up to 100 characters).</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>What the package includes (up to 500 characters), shown to the coach only.</summary>
    public string? Description { get; set; }

    /// <summary>Price per billing period, above 0 and at most 1 000 000 CZK or 50 000 EUR, with up to 2 decimals.</summary>
    public decimal Price { get; set; }

    /// <summary>The currency of the price; cannot change while client terms use the package.</summary>
    public PaymentCurrency Currency { get; set; } = PaymentCurrency.CZK;

    /// <summary>How often the package is billed.</summary>
    public PackageBillingInterval Billing { get; set; } = PackageBillingInterval.Monthly;

    /// <summary>Weeks between payments (1-52); required for every-N-weeks billing, otherwise omitted.</summary>
    public int? IntervalWeeks { get; set; }

    /// <summary>Number of payments the package runs for (1-120); omitted for until-cancelled and one-off.</summary>
    public int? RunsForPayments { get; set; }

    /// <summary>Payment due days (1-90) overriding the coach's default.</summary>
    public int? PaymentDueDaysOverride { get; set; }

    /// <summary>Whether the price is shown on the coach's public profile.</summary>
    public bool ShowOnProfile { get; set; } = true;
}
