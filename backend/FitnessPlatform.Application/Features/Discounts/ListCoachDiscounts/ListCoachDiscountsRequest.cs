namespace FitnessPlatform.Application.Features.Discounts.ListCoachDiscounts;

/// <summary>
/// Query for listing the calling coach's discounts.
/// </summary>
public class ListCoachDiscountsRequest
{
    /// <summary>Whether archived discounts are included; defaults to false.</summary>
    public bool IncludeArchived { get; set; }
}
