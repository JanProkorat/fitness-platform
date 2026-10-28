namespace FitnessPlatform.Application.Features.ClientNutrition.GetShoppingList;

/// <summary>
/// Response model containing an aggregated shopping list from the nutrition plan.
/// </summary>
public class GetShoppingListResponse
{
    /// <summary>
    /// Aggregated food items with total amounts needed.
    /// </summary>
    public List<ShoppingListItem> Items { get; set; } = [];
}

/// <summary>
/// A single item on the shopping list with aggregated amount.
/// </summary>
public class ShoppingListItem
{
    /// <summary>
    /// External identifier of the food.
    /// </summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>
    /// Display name of the food.
    /// </summary>
    public string FoodName { get; set; } = string.Empty;

    /// <summary>
    /// Czech name of the food, when known.
    /// </summary>
    public string? FoodNameCs { get; set; }

    /// <summary>
    /// English name of the food, when known.
    /// </summary>
    public string? FoodNameEn { get; set; }

    /// <summary>
    /// German name of the food, when known.
    /// </summary>
    public string? FoodNameDe { get; set; }

    /// <summary>
    /// Total amount needed in grams.
    /// </summary>
    public decimal TotalAmountGrams { get; set; }

    /// <summary>
    /// Food category name (the plan's snapshot, else the food's own category, else "Other").
    /// </summary>
    public string FoodCategory { get; set; } = "Other";

    /// <summary>
    /// True when the item is ticked in every requested week it appears in.
    /// </summary>
    public bool IsTicked { get; set; }
}
