namespace FitnessPlatform.Application.Features.NutritionPlans.CopyPlan;

/// <summary>
/// Response describing the new plan created by copying an existing one.
/// </summary>
public class CopyNutritionPlanResponse
{
    /// <summary>
    /// The newly created plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// The target client's <c>ClientProfile.PublicId</c> — echoes the caller-supplied value.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Display name of the new plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Status of the new plan — always <c>Draft</c> immediately after the copy.
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// When the new plan was created.
    /// </summary>
    public DateTime DateCreated { get; set; }
}
