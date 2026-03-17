using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Application.Features.Foods.SearchFoods;

/// <summary>
/// Response model for food search results.
/// </summary>
public class SearchFoodsResponse
{
    /// <summary>
    /// List of matching food items.
    /// </summary>
    public List<FoodSummary> Foods { get; set; } = [];

    /// <summary>
    /// Total number of matching foods.
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
