namespace FitnessPlatform.Application.Features.ClientPayments.SetClientPaymentTerms;

/// <summary>
/// Request for setting the package, and the discount or custom price, a client pays under.
/// </summary>
public class SetClientPaymentTermsRequest
{
    /// <summary>Route parameter — the client's profile public id; matches <c>{ClientId}</c> in the route.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Public id of one of the coach's packages.</summary>
    public Guid PackageId { get; set; }

    /// <summary>Public id of one of the coach's discounts; cannot be combined with <see cref="CustomPrice"/>.</summary>
    public Guid? DiscountId { get; set; }

    /// <summary>A price replacing the package price and discount for this client; cannot be combined with <see cref="DiscountId"/>.</summary>
    public decimal? CustomPrice { get; set; }

    /// <summary>
    /// First day of the first billing period; today when omitted. Used only the first time terms are set,
    /// and not before today.
    /// </summary>
    public DateOnly? FirstPeriodStart { get; set; }
}
