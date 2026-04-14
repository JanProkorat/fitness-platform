namespace FitnessPlatform.Application.Features.ClientNutrition.UnlogMealEaten;

/// <summary>
/// Request model for un-logging (removing) a previously logged meal for the current day.
/// </summary>
public class UnlogMealEatenRequest
{
    /// <summary>
    /// The unique identifier of the meal to unmark.
    /// </summary>
    public Guid MealId { get; set; }
}
