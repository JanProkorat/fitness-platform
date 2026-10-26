using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Discounts.Shared;

namespace FitnessPlatform.Application.Features.Discounts.UpdateCoachDiscount;

/// <summary>
/// Request for updating a coach discount.
/// </summary>
public class UpdateCoachDiscountRequest : ICoachDiscountInput
{
    /// <summary>Route parameter — public id of the discount.</summary>
    public Guid DiscountId { get; set; }

    /// <summary>Display name (up to 100 characters).</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Whether the value is a percentage or a fixed amount.</summary>
    public DiscountType Type { get; set; } = DiscountType.Percentage;

    /// <summary>The percentage (1-100) or the fixed amount (above 0, up to 2 decimals).</summary>
    public decimal Value { get; set; }

    /// <summary>How many payments the discount applies to.</summary>
    public DiscountDuration Duration { get; set; } = DiscountDuration.EveryPayment;

    /// <summary>Number of payments covered (1-120); required for first-N-payments, otherwise omitted.</summary>
    public int? DurationPayments { get; set; }

    /// <summary>First payment due date the discount applies to (inclusive); omit for no start limit.</summary>
    public DateOnly? ValidFrom { get; set; }

    /// <summary>Last payment due date the discount applies to (inclusive); omit for open-ended.</summary>
    public DateOnly? ValidTo { get; set; }

    /// <summary>The currency of a fixed amount (required for a fixed amount, ignored for a percentage); cannot change while client terms use the discount.</summary>
    public PaymentCurrency? Currency { get; set; }

    /// <summary>Which packages the discount can be used with.</summary>
    public DiscountScope Scope { get; set; } = DiscountScope.AllPackages;

    /// <summary>Public ids of the packages the discount is limited to; used only for selected packages.</summary>
    public List<Guid> PackageIds { get; set; } = [];
}
