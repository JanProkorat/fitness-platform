using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Client.Invites.Shared;

/// <summary>
/// The package an invitation offers, with the price the client would pay for the first payment.
/// </summary>
public class InvitePackageDto
{
    /// <summary>Display name of the package.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>How often the package is billed.</summary>
    public PackageBillingInterval Billing { get; set; }

    /// <summary>Weeks between payments; set only for a package billed every N weeks.</summary>
    public int? IntervalWeeks { get; set; }

    /// <summary>Number of payments the package runs for; null means until cancelled.</summary>
    public int? RunsForPayments { get; set; }

    /// <summary>What the package includes; null for none.</summary>
    public string? Description { get; set; }

    /// <summary>The package price per payment before any discount.</summary>
    public decimal BasePrice { get; set; }

    /// <summary>The discount as shown next to a price, or null when no discount applies.</summary>
    public string? DiscountLabel { get; set; }

    /// <summary>The price per payment after the discount.</summary>
    public decimal FinalPrice { get; set; }

    /// <summary>Currency of the prices.</summary>
    public PaymentCurrency Currency { get; set; }
}
