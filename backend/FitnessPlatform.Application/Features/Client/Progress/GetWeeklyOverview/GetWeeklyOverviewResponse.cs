using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.Client.Progress.GetWeeklyOverview;

/// <summary>
/// Response model containing a client's weekly progress overview.
/// </summary>
public class GetWeeklyOverviewResponse
{
    /// <summary>
    /// Monday of the current week.
    /// </summary>
    public DateTime WeekStart { get; set; }

    /// <summary>
    /// Sunday of the current week.
    /// </summary>
    public DateTime WeekEnd { get; set; }

    /// <summary>
    /// Compliance percentage for the current week (0-100).
    /// </summary>
    public decimal CompliancePercent { get; set; }

    /// <summary>
    /// Total number of meals planned for the current week.
    /// </summary>
    public int MealsPlanned { get; set; }

    /// <summary>
    /// Total number of meals logged for the current week.
    /// </summary>
    public int MealsLogged { get; set; }

    /// <summary>
    /// Average daily macronutrient totals for the current week.
    /// </summary>
    public NutrientTotals AverageDailyMacros { get; set; } = new();

    /// <summary>
    /// Current streak of consecutive compliant days.
    /// </summary>
    public int CurrentStreak { get; set; }
}
