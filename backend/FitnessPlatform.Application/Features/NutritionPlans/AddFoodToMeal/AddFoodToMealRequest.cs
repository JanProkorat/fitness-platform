namespace FitnessPlatform.Application.Features.NutritionPlans.AddFoodToMeal;

/// <summary>
/// Request to add a food item to a meal within a nutrition plan.
/// </summary>
public class AddFoodToMealRequest
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
    /// The food item's public identifier.
    /// </summary>
    public Guid FoodExternalId { get; set; }

    /// <summary>
    /// Amount of this food in grams.
    /// </summary>
    public decimal AmountGrams { get; set; }
}
