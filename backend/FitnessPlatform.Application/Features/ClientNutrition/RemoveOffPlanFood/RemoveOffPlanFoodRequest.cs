using FastEndpoints;

namespace FitnessPlatform.Application.Features.ClientNutrition.RemoveOffPlanFood;

/// <summary>
/// Request for removing an off-plan food entry from a day's log.
/// </summary>
public class RemoveOffPlanFoodRequest
{
    /// <summary>Route parameter — the entry id returned (or chosen by the client) when the food was added.</summary>
    public Guid EntryId { get; set; }

    /// <summary>
    /// When the client removed the entry (offline sync); selects the day log to look in.
    /// Defaults to the server clock; at most 5 minutes ahead and 7 days back.
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
