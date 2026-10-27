namespace FitnessPlatform.Application.Features.Discounts.ArchiveCoachDiscount;

/// <summary>
/// Request for archiving a coach discount.
/// </summary>
public class ArchiveCoachDiscountRequest
{
    /// <summary>Route parameter — public id of the discount.</summary>
    public Guid DiscountId { get; set; }
}
