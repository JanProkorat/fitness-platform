using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Request for a full-state update of a nutrition plan: replaces name, settings, and all weeks/days/meals/foods.
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

    /// <summary>
    /// Full week structure to persist. Replaces all existing weeks, days, meals, and foods.
    /// </summary>
    public List<UpdateWeekRequest> Weeks { get; set; } = [];
}
