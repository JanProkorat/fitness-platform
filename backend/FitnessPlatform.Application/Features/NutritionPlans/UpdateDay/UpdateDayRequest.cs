using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdateDay;

/// <summary>
/// Request to replace all meals for a specific day in a nutrition plan.
/// </summary>
public class UpdateDayRequest
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
    /// Complete list of meals to replace the day's current meals.
    /// </summary>
    public List<UpdateDayMealDto> Meals { get; set; } = [];
}

/// <summary>
/// DTO representing a meal within an UpdateDay request.
/// </summary>
public class UpdateDayMealDto
{
    /// <summary>
    /// The meal's unique identifier within the plan.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// Display name of the meal.
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

    /// <summary>
    /// Foods included in this meal.
    /// </summary>
    public List<UpdateDayFoodDto> Foods { get; set; } = [];
}

/// <summary>
/// DTO representing a food item within an UpdateDay meal.
/// </summary>
public class UpdateDayFoodDto
{
    /// <summary>
    /// Reference to the original food document's ExternalId.
    /// </summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>
    /// Snapshot of the food name.
    /// </summary>
    public string FoodName { get; set; } = string.Empty;

    /// <summary>
    /// Snapshot of nutritional values per 100 grams.
    /// </summary>
    public NutrientValue NutrientValuePer100Grams { get; set; } = new();

    /// <summary>
    /// Amount of this food in grams.
    /// </summary>
    public decimal AmountGrams { get; set; }
}
