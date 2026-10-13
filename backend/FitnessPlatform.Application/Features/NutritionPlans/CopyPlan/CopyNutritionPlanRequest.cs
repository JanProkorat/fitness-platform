namespace FitnessPlatform.Application.Features.NutritionPlans.CopyPlan;

/// <summary>
/// Request to copy an existing nutrition plan to a client as a new Draft plan.
/// </summary>
public class CopyNutritionPlanRequest
{
    /// <summary>
    /// The source plan's public identifier (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// The target client's <c>ClientProfile.PublicId</c> — the coach-facing identifier, not the
    /// internal <c>ApplicationUser.Id</c> storage key. May be the source plan's own client.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Optional display name for the copy. Defaults to the source plan's name.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Optional start date. Must be a Monday and not in the past.
    /// </summary>
    public DateTime? StartDate { get; set; }
}
