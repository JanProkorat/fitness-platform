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

    /// <summary>
    /// When the client ticked the item (offline sync); selects the plan current on that day.
    /// Defaults to the server clock; at most 5 minutes ahead and 7 days back.
    /// </summary>
    public DateTimeOffset? OccurredAt { get; set; }

    /// <summary>Client-generated id that makes a retried request apply only once.</summary>
    public Guid? ClientRequestId { get; set; }

    /// <summary>The <c>NutritionPlan.Version</c> the client saw when it queued the request.</summary>
    public int? BasedOnPlanVersion { get; set; }
}
