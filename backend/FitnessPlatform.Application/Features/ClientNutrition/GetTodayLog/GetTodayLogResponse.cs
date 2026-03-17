using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayLog;

/// <summary>
/// Response model for the client's meal log for today.
/// </summary>
public class GetTodayLogResponse
{
    /// <summary>
    /// Meals eaten today.
    /// </summary>
    public List<MealLogDto> MealsEaten { get; set; } = [];

    /// <summary>
    /// Total nutrients consumed across all meals today.
    /// </summary>
    public NutrientTotals TotalConsumed { get; set; } = new();

    /// <summary>
    /// Remaining nutrients to reach the daily target.
    /// Null if the active plan has no global settings.
    /// </summary>
    public NutrientTotals? Remaining { get; set; }
}

/// <summary>
/// DTO representing a single logged meal with computed nutrient totals.
/// </summary>
public class MealLogDto
{
    /// <summary>
    /// Identifier of the meal that was eaten.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// Display name of the meal (resolved from the plan).
    /// </summary>
    public string MealName { get; set; } = string.Empty;

    /// <summary>
    /// When the meal was eaten.
    /// </summary>
    public DateTime EatenAt { get; set; }

    /// <summary>
    /// Computed nutrient totals for this logged meal.
    /// </summary>
    public NutrientTotals Totals { get; set; } = new();
}
