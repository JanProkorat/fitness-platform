using FastEndpoints;

namespace FitnessPlatform.Application.Features.Recipes.SearchRecipes;

/// <summary>
/// Request model for searching recipes.
/// </summary>
public class SearchRecipesRequest
{
    /// <summary>
    /// Optional search term to filter recipes by name.
    /// </summary>
    [BindFrom("search")]
    public string? Search { get; set; }

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
