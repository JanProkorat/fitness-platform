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
    /// Optional category filter.
    /// </summary>
    public FoodCategory? Category { get; set; }

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
