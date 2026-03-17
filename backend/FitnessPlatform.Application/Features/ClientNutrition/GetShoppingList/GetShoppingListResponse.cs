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
    /// Total amount needed in grams.
    /// </summary>
    public decimal TotalAmountGrams { get; set; }
}
