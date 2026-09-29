using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Foods.SearchFoods;

/// <summary>
/// Request model for searching foods.
/// </summary>
public class SearchFoodsRequest
{
    /// <summary>
    /// Free-text search query.
    /// </summary>
    [BindFrom("q")]
    public string? Query { get; set; }

    /// <summary>
    /// Optional category filter — matches a food carrying ANY of the supplied categories. Bound
    /// from the repeated <c>category</c> query param, so a single <c>?category=Dairy</c> still
    /// binds a one-item list.
    /// </summary>
    [BindFrom("category")]
    public List<FoodCategory> Categories { get; set; } = [];

    /// <summary>
    /// Optional tags filter — matches a food carrying ANY of the supplied tags. At most 20.
    /// </summary>
    public List<string> Tags { get; set; } = [];

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
