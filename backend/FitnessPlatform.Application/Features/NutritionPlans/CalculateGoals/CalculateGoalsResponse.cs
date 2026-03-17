using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.CalculateGoals;

/// <summary>
/// Response model showing the calculated BMR, TDEE, and macro targets.
/// </summary>
public class CalculateGoalsResponse
{
    /// <summary>
    /// Calculated Basal Metabolic Rate (Mifflin-St Jeor) in kcal/day.
    /// </summary>
    public decimal Bmr { get; set; }

    /// <summary>
    /// Total Daily Energy Expenditure in kcal/day.
    /// </summary>
    public decimal Tdee { get; set; }

    /// <summary>
    /// Adjusted daily kcal after applying the goal (cut/maintain/bulk).
    /// </summary>
    public decimal AdjustedKcal { get; set; }

    /// <summary>
    /// Calculated macro split with daily targets.
    /// </summary>
    public GlobalNutritionSettings MacroTargets { get; set; } = new();
}
