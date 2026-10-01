using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Recipes.SearchRecipes;

/// <summary>
/// Request model for searching recipes.
/// </summary>
public class SearchRecipesRequest
{
    /// <summary>
    /// Optional search term matched against recipe name and description.
    /// </summary>
    [BindFrom("search")]
    public string? Search { get; set; }

    /// <summary>
    /// Optional meal type filter — matches a recipe carrying ANY of the supplied meal types. Bound
    /// from the repeated <c>mealType</c> query param.
    /// </summary>
    [BindFrom("mealType")]
    public List<RecipeMealType> MealTypes { get; set; } = [];

    /// <summary>
    /// Optional dietary preference filter — matches a recipe carrying ALL of the supplied
    /// preferences. Bound from the repeated <c>dietaryPreference</c> query param.
    /// </summary>
    [BindFrom("dietaryPreference")]
    public List<DietaryPreference> DietaryPreferences { get; set; } = [];

    /// <summary>
    /// Optional owner filter — matches a recipe whose ownership falls under ANY of the supplied
    /// values (System means the platform catalog). Bound from the repeated <c>owner</c> query param.
    /// </summary>
    [BindFrom("owner")]
    public List<FoodOwnerFilter> Owners { get; set; } = [];

    /// <summary>
    /// Column to sort by. <see langword="null"/> (the default) means newest-created first.
    /// </summary>
    public RecipeSortField? SortBy { get; set; }

    /// <summary>
    /// Direction for <see cref="SortBy"/>; defaults to ascending when <see cref="SortBy"/> is set.
    /// Ignored when <see cref="SortBy"/> is <see langword="null"/>.
    /// </summary>
    public FoodSortDirection? SortDir { get; set; }

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
