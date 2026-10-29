namespace FitnessPlatform.Application.Features.ClientNutrition.AddOffPlanFood;

/// <summary>
/// Request for logging a food eaten outside the plan.
/// </summary>
public class AddOffPlanFoodRequest
{
    /// <summary>The food's ExternalId.</summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>Amount eaten in grams.</summary>
    public decimal AmountGrams { get; set; }

    /// <summary>
    /// Client-chosen id for the new entry (offline sync), so the client can remove it by that id
    /// before the add is confirmed. An id already present in that day's log is a replay.
    /// </summary>
    public Guid? EntryId { get; set; }

    /// <summary>
    /// When the client ate the food (offline sync). Defaults to the server clock;
    /// at most 5 minutes ahead and 7 days back.
    /// </summary>
    public DateTimeOffset? OccurredAt { get; set; }

    /// <summary>Client-generated id that makes a retried request apply only once.</summary>
    public Guid? ClientRequestId { get; set; }

    /// <summary>The <c>NutritionPlan.Version</c> the client saw when it queued the request.</summary>
    public int? BasedOnPlanVersion { get; set; }
}
