namespace FitnessPlatform.Application.Features.NutritionPlans.CalculateGoals;

/// <summary>
/// Request model for calculating nutrition goals based on client anamnesis.
/// </summary>
public class CalculateGoalsRequest
{
    /// <summary>
    /// The client's ApplicationUser.Id (route parameter).
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Body weight in kilograms.
    /// </summary>
    public decimal WeightKg { get; set; }

    /// <summary>
    /// Height in centimeters.
    /// </summary>
    public decimal HeightCm { get; set; }

    /// <summary>
    /// Age in years.
    /// </summary>
    public int Age { get; set; }

    /// <summary>
    /// Biological sex for BMR calculation.
    /// </summary>
    public string Sex { get; set; } = string.Empty;

    /// <summary>
    /// Physical activity level.
    /// </summary>
    public string ActivityLevel { get; set; } = string.Empty;

    /// <summary>
    /// Nutrition goal (Cut, Maintain, Bulk).
    /// </summary>
    public string Goal { get; set; } = string.Empty;

    /// <summary>
    /// Custom protein percentage (default 30).
    /// </summary>
    public decimal ProteinPercent { get; set; } = 30m;

    /// <summary>
    /// Custom carbs percentage (default 45).
    /// </summary>
    public decimal CarbsPercent { get; set; } = 45m;

    /// <summary>
    /// Custom fat percentage (default 25).
    /// </summary>
    public decimal FatPercent { get; set; } = 25m;
}
