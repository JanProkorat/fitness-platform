using FastEndpoints;

namespace FitnessPlatform.Application.Features.ClientNutrition.UnlogMealItemEaten;

/// <summary>
/// Request model for unmarking one food or recipe of a plan meal.
/// </summary>
public class UnlogMealItemEatenRequest
{
    /// <summary>The plan meal that holds the item.</summary>
    public Guid MealId { get; set; }

    /// <summary>The food or recipe item (its <c>itemId</c> in the plan meal).</summary>
    public Guid ItemId { get; set; }

    /// <summary>
    /// When the client unmarked the item (offline sync). Defaults to the server clock;
    /// at most 5 minutes ahead and 7 days back.
    /// </summary>
    [QueryParam]
    public DateTimeOffset? OccurredAt { get; set; }

    /// <summary>Client-generated id that makes a retried request apply only once.</summary>
    [QueryParam]
    public Guid? ClientRequestId { get; set; }

    /// <summary>The <c>NutritionPlan.Version</c> the client saw when it queued the request.</summary>
    [QueryParam]
    public int? BasedOnPlanVersion { get; set; }
}
