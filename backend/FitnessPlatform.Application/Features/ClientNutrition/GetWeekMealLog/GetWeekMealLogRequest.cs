namespace FitnessPlatform.Application.Features.ClientNutrition.GetWeekMealLog;

/// <summary>
/// Request model for reading the meal log of the plan week that contains a date.
/// </summary>
public class GetWeekMealLogRequest
{
    /// <summary>
    /// Any client-local calendar date inside the active plan (<c>yyyy-MM-dd</c>); the plan week
    /// containing it is returned.
    /// </summary>
    public DateOnly Date { get; set; }
}
