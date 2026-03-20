using FastEndpoints;

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
    /// Filter by source: "system", "custom", "openfoodfacts".
    /// </summary>
    public string? Source { get; set; }

    /// <summary>
    /// When true, skip supplementing results from external APIs (Open Food Facts).
    /// Local MongoDB results are returned immediately without waiting for external calls.
    /// </summary>
    public bool ExcludeExternal { get; set; }

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
