namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Column a recipe search can be sorted by. Direction is a <see cref="FoodSortDirection"/>.
/// </summary>
public enum RecipeSortField
{
    /// <summary>Recipe name.</summary>
    Name,

    /// <summary>Total kcal divided by servings.</summary>
    CaloriesPerServing,

    /// <summary>Number of servings.</summary>
    Servings,

    /// <summary>Ownership bucket: mine, other coaches, system.</summary>
    Library,

    /// <summary>Creation time.</summary>
    DateCreated
}
