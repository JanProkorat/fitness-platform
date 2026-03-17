using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Application.Features.Foods.GetCustomFoods;

/// <summary>
/// Response model for a nutritionist's custom foods.
/// </summary>
public class GetCustomFoodsResponse
{
    /// <summary>
    /// List of custom food items.
    /// </summary>
    public List<FoodSummary> Foods { get; set; } = [];

    /// <summary>
    /// Total number of custom foods.
    /// </summary>
    public long TotalCount { get; set; }

    /// <summary>
    /// Current page number.
    /// </summary>
    public int Page { get; set; }

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; }
}
