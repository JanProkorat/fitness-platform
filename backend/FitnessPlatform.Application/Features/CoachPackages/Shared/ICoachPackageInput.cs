using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.CoachPackages.Shared;

/// <summary>
/// The editable fields of a coach package, shared by the create and update requests so one validator covers both.
/// </summary>
public interface ICoachPackageInput
{
    /// <summary>Display name.</summary>
    string Name { get; }

    /// <summary>What the package includes, shown to the coach only.</summary>
    string? Description { get; }

    /// <summary>Price per billing period.</summary>
    decimal Price { get; }

    /// <summary>The currency of the price.</summary>
    PaymentCurrency Currency { get; }

    /// <summary>How often the package is billed.</summary>
    PackageBillingInterval Billing { get; }

    /// <summary>Weeks between payments; required for every-N-weeks billing, forbidden otherwise.</summary>
    int? IntervalWeeks { get; }

    /// <summary>Number of payments the package runs for; forbidden for one-off packages.</summary>
    int? RunsForPayments { get; }

    /// <summary>Payment due days overriding the coach's default.</summary>
    int? PaymentDueDaysOverride { get; }
}
