using FormUp.Application.Features.Discounts.Shared;

namespace FormUp.Application.Features.Discounts.ListCoachDiscounts;

/// <summary>
/// The calling coach's discounts.
/// </summary>
public class ListCoachDiscountsResponse
{
    /// <summary>Discounts, active first, then by name.</summary>
    public List<CoachDiscountDto> Items { get; set; } = [];
}
