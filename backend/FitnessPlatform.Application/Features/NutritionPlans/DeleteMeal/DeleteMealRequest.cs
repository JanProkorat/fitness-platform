namespace FitnessPlatform.Application.Features.NutritionPlans.DeleteMeal;

/// <summary>
/// Request to delete a meal from a nutrition plan day.
/// </summary>
public class DeleteMealRequest
{
    /// <summary>
    /// The plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Week number within the plan (1-based).
    /// </summary>
    public int WeekNumber { get; set; }

    /// <summary>
    /// Day of the week (1 = Monday, 7 = Sunday).
    /// </summary>
    public int DayOfWeek { get; set; }

    /// <summary>
    /// The meal's unique identifier within the plan.
    /// </summary>
    public Guid MealId { get; set; }
}
