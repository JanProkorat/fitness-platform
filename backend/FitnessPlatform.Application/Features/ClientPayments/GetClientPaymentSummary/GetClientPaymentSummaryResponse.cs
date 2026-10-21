using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentSummary;

/// <summary>
/// The payment summary of a client: their package and price, the next payment, how far they have paid.
/// </summary>
public class GetClientPaymentSummaryResponse
{
    /// <summary>Public id of the client's profile.</summary>
    public Guid ClientId { get; set; }

    /// <summary>When the coach and the client first linked (UTC).</summary>
    public DateTime ClientSince { get; set; }

    /// <summary>Whether the coach has a bank account set, which a payment request needs.</summary>
    public bool BankAccountSet { get; set; }

    /// <summary>The client's current terms; null until the coach sets a package.</summary>
    public ClientPaymentSummaryTermsDto? Terms { get; set; }

    /// <summary>What the client pays per period under the current terms; null without terms.</summary>
    public ClientPaymentSummaryPriceDto? Price { get; set; }

    /// <summary>First day of the next billing period, which changes to the terms apply from.</summary>
    public DateOnly? NextPeriodStart { get; set; }

    /// <summary>The earliest payment still waiting for the money; null when everything is settled.</summary>
    public ClientPaymentSummaryNextDto? NextPayment { get; set; }

    /// <summary>Last day covered by the latest paid period.</summary>
    public DateOnly? PaidUntil { get; set; }

    /// <summary>Payments paid.</summary>
    public int PaidCount { get; set; }

    /// <summary>Payments that are paid or overdue; waived and not-yet-due payments are not counted.</summary>
    public int TotalCount { get; set; }
}

/// <summary>
/// The package, discount and custom price a client pays under.
/// </summary>
public class ClientPaymentSummaryTermsDto
{
    /// <summary>Public id of the package.</summary>
    public Guid PackageId { get; set; }

    /// <summary>Name of the package.</summary>
    public string PackageName { get; set; } = string.Empty;

    /// <summary>The package's current price per billing period.</summary>
    public decimal PackagePrice { get; set; }

    /// <summary>How often the package is billed.</summary>
    public PackageBillingInterval Billing { get; set; }

    /// <summary>Weeks between payments for an every-N-weeks package.</summary>
    public int? IntervalWeeks { get; set; }

    /// <summary>Public id of the discount; null for none.</summary>
    public Guid? DiscountId { get; set; }

    /// <summary>Name of the discount.</summary>
    public string? DiscountName { get; set; }

    /// <summary>Whether the discount is a percentage or a fixed amount.</summary>
    public DiscountType? DiscountType { get; set; }

    /// <summary>The percentage or the fixed amount taken off.</summary>
    public decimal? DiscountValue { get; set; }

    /// <summary>A price replacing the package price and discount for this client; null for none.</summary>
    public decimal? CustomPrice { get; set; }

    /// <summary>When the terms take effect (UTC).</summary>
    public DateTime EffectiveFromUtc { get; set; }
}

/// <summary>
/// The price breakdown of the client's next period.
/// </summary>
public class ClientPaymentSummaryPriceDto
{
    /// <summary>The package price before any discount.</summary>
    public decimal BasePrice { get; set; }

    /// <summary>What the discount takes off; zero for none.</summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>Label of the discount or custom price.</summary>
    public string? DiscountLabel { get; set; }

    /// <summary>Whether a custom price replaces the package price.</summary>
    public bool IsCustomPrice { get; set; }

    /// <summary>What the client pays.</summary>
    public decimal Amount { get; set; }
}

/// <summary>
/// The next payment waiting for the money.
/// </summary>
public class ClientPaymentSummaryNextDto
{
    /// <summary>Public id of the payment.</summary>
    public Guid PaymentId { get; set; }

    /// <summary>Amount in CZK.</summary>
    public decimal? Amount { get; set; }

    /// <summary>Day the payment falls due.</summary>
    public DateOnly DueDate { get; set; }

    /// <summary>Status; Overdue is derived from the due date.</summary>
    public ClientPaymentStatus Status { get; set; }

    /// <summary>When the client was last asked to pay (UTC); null if never.</summary>
    public DateTime? RequestedAt { get; set; }
}
