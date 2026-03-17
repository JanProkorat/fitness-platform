namespace FitnessPlatform.Application.Features.NutritionPlans.UpdateMeal;

/// <summary>
/// Request to update an existing meal in a nutrition plan day.
/// </summary>
public class UpdateMealRequest
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

    /// <summary>
    /// Updated display name of the meal.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated display order within the day (1-based).
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Updated suggested time for the meal (e.g. "08:00").
    /// </summary>
    public string? Time { get; set; }
}
