namespace FitnessPlatform.Application.Features.ClientNutrition.RemoveOffPlanFood;

/// <summary>
/// Request for removing an off-plan food entry added today.
/// </summary>
public class RemoveOffPlanFoodRequest
{
    /// <summary>Route parameter — the entry id returned when the food was added.</summary>
    public Guid EntryId { get; set; }
}
