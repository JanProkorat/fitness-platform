using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Request to update a nutrition plan's name and global settings with optimistic concurrency.
/// </summary>
public class UpdatePlanRequest
{
    /// <summary>
    /// The plan's public identifier (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Updated display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated global daily nutrition targets.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// Expected version for optimistic concurrency control.
    /// </summary>
    public int Version { get; set; }
}
