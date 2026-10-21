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

    /// <summary>Whether the discount applies to every package.</summary>
    public bool AppliesToAllPackages { get; set; }

    /// <summary>Public ids of the packages the discount is limited to; ignored when it applies to all.</summary>
    public List<Guid> PackageIds { get; set; } = [];
}
