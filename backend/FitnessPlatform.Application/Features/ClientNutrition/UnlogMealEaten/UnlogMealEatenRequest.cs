using FastEndpoints;

namespace FitnessPlatform.Application.Features.ClientNutrition.UnlogMealEaten;

/// <summary>
/// Request model for un-logging (removing) a previously logged meal for the current day.
/// </summary>
public class UnlogMealEatenRequest
{
    /// <summary>
    /// The unique identifier of the meal to unmark.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// When the client unmarked the meal (offline sync). Defaults to the server clock;
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
