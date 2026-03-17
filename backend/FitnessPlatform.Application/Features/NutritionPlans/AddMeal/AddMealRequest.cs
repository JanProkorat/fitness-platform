namespace FitnessPlatform.Application.Features.NutritionPlans.AddMeal;

/// <summary>
/// Request to add a new meal to a specific day in a nutrition plan.
/// </summary>
public class AddMealRequest
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
    /// Display name of the meal (e.g. "Breakfast", "Lunch").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Display order within the day (1-based).
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Optional suggested time for the meal (e.g. "08:00").
    /// </summary>
    public string? Time { get; set; }
}
