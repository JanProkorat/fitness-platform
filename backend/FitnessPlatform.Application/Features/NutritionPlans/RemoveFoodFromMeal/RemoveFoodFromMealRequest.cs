namespace FitnessPlatform.Application.Features.NutritionPlans.RemoveFoodFromMeal;

/// <summary>
/// Request to remove a food item from a meal within a nutrition plan.
/// </summary>
public class RemoveFoodFromMealRequest
{
    /// <summary>
    /// The plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// The meal's unique identifier within the plan.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// The food item's public identifier to remove.
    /// </summary>
    public Guid FoodExternalId { get; set; }
}
