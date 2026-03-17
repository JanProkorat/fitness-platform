namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// Request model for logging a meal as eaten.
/// </summary>
public class LogMealEatenRequest
{
    /// <summary>
    /// The unique identifier of the meal to log as eaten.
    /// </summary>
    public Guid MealId { get; set; }
}
