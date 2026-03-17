using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayPlan;

/// <summary>
/// Response model for the client's active nutrition plan for today.
/// </summary>
public class GetTodayPlanResponse
{
    /// <summary>
    /// External identifier of the nutrition plan.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Display name of the nutrition plan.
    /// </summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>
    /// Current week number within the plan (1-based).
    /// </summary>
    public int WeekNumber { get; set; }

    /// <summary>
    /// Current day of the week (1 = Monday … 7 = Sunday).
    /// </summary>
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Meals scheduled for today.
    /// </summary>
    public List<PlanMeal> Meals { get; set; } = [];

    /// <summary>
    /// Computed nutrient totals for today.
    /// </summary>
    public NutrientTotals? DayTotals { get; set; }

    /// <summary>
    /// Global daily nutrition targets for the plan.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }
}
