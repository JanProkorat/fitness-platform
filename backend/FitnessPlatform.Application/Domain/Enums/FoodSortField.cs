namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Sortable columns on the Ingredients page's food search.
/// </summary>
public enum FoodSortField
{
    /// <summary>Sorts by the resolved display name, in the caller's language collation.</summary>
    Name,

    /// <summary>Sorts by kilocalories per 100 grams.</summary>
    Calories,

    /// <summary>Sorts by a fixed, server-defined category order (not alphabetical by label).</summary>
    Category,

    /// <summary>Sorts Mine before Other coaches before System.</summary>
    Library
}
