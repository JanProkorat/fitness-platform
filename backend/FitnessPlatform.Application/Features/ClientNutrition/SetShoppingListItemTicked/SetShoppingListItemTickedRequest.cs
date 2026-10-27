namespace FitnessPlatform.Application.Features.ClientNutrition.SetShoppingListItemTicked;

/// <summary>
/// Request for ticking or unticking one shopping-list item in one plan week.
/// </summary>
public class SetShoppingListItemTickedRequest
{
    /// <summary>Week number within the plan (1-based).</summary>
    public int WeekNumber { get; set; }

    /// <summary>The food's ExternalId as on the shopping list.</summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>True to tick, false to untick. Repeating the same value is a no-op.</summary>
    public bool IsTicked { get; set; }
}
