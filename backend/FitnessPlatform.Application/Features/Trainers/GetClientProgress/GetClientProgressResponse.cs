using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.Trainers.GetClientProgress;

/// <summary>
/// Response model containing a client's progress data for the trainer view.
/// </summary>
public class GetClientProgressResponse
{
    /// <summary>
    /// Compliance percentage (0-100), representing how many planned meals were logged.
    /// </summary>
    public decimal CompliancePercent { get; set; }

    /// <summary>
    /// Total number of meals planned in the date range.
    /// </summary>
    public int MealsPlanned { get; set; }

    /// <summary>
    /// Total number of meals logged in the date range.
    /// </summary>
    public int MealsLogged { get; set; }

    /// <summary>
    /// Current streak of consecutive compliant days.
    /// </summary>
    public int CurrentStreak { get; set; }

    /// <summary>
    /// Average daily macronutrient totals for the date range.
    /// </summary>
    public NutrientTotals AverageDailyMacros { get; set; } = new();

    /// <summary>
    /// Start date of the progress calculation range.
    /// </summary>
    public DateTime From { get; set; }

    /// <summary>
    /// End date of the progress calculation range.
    /// </summary>
    public DateTime To { get; set; }
}
