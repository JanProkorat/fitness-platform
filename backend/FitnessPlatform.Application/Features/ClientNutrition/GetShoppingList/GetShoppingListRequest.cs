namespace FitnessPlatform.Application.Features.ClientNutrition.GetShoppingList;

/// <summary>
/// Request model for generating a shopping list from the active nutrition plan.
/// </summary>
public class GetShoppingListRequest
{
    /// <summary>
    /// Starting week number (1-based, inclusive). Defaults to 1.
    /// </summary>
    public int WeekFrom { get; set; } = 1;

    /// <summary>
    /// Ending week number (1-based, inclusive). Defaults to all weeks.
    /// </summary>
    public int? WeekTo { get; set; }
}
