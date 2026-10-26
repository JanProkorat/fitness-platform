namespace FitnessPlatform.Application.Features.Discounts.GetCoachDiscount;

/// <summary>
/// Request for reading one coach discount.
/// </summary>
public class GetCoachDiscountRequest
{
    /// <summary>Route parameter — public id of the discount.</summary>
    public Guid DiscountId { get; set; }
}
