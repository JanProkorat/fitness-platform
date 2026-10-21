namespace FitnessPlatform.Application.Features.ClientPayments.SetClientPaymentTerms;

/// <summary>
/// The terms now in force for a client.
/// </summary>
public class SetClientPaymentTermsResponse
{
    /// <summary>Public id of the package.</summary>
    public Guid PackageId { get; set; }

    /// <summary>Public id of the discount; null for none.</summary>
    public Guid? DiscountId { get; set; }

    /// <summary>The custom price; null for none.</summary>
    public decimal? CustomPrice { get; set; }

    /// <summary>When the terms take effect (UTC).</summary>
    public DateTime EffectiveFromUtc { get; set; }

    /// <summary>First billing period the terms apply to.</summary>
    public DateOnly? AppliesFromPeriodStart { get; set; }

    /// <summary>What the client pays for that period.</summary>
    public decimal? Amount { get; set; }
}
