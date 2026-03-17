using FitnessPlatform.Application.Features.Recipes.Shared;

namespace FitnessPlatform.Application.Features.Recipes.SearchRecipes;

/// <summary>
/// Paginated response for recipe search results.
/// </summary>
public class SearchRecipesResponse
{
    /// <summary>
    /// List of matching recipes.
    /// </summary>
    public List<RecipeSummaryDto> Recipes { get; set; } = [];

    /// <summary>
    /// Total number of matching recipes.
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
