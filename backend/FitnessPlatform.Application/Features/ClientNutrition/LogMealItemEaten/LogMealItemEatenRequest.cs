namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealItemEaten;

/// <summary>
/// Request model for marking one food or recipe of a plan meal as eaten.
/// </summary>
public class LogMealItemEatenRequest
{
    /// <summary>The plan meal that holds the item.</summary>
    public Guid MealId { get; set; }

    /// <summary>The food or recipe item (its <c>itemId</c> in the plan meal).</summary>
    public Guid ItemId { get; set; }

    /// <summary>
    /// When the client actually ate the item (offline sync). Defaults to the server clock;
    /// at most 5 minutes ahead and 7 days back.
    /// </summary>
    public DateTimeOffset? OccurredAt { get; set; }

    /// <summary>Client-generated id that makes a retried request apply only once.</summary>
    public Guid? ClientRequestId { get; set; }

    /// <summary>The <c>NutritionPlan.Version</c> the client saw when it queued the request.</summary>
    public int? BasedOnPlanVersion { get; set; }
}
