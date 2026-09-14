using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.Trainers.GetClientProgress;

/// <summary>
/// Response model containing a client's progress data for the trainer view.
/// </summary>
public class GetClientProgressResponse
{
    /// <summary>
    /// Compliance percentage (0-100). Scoped to the caller's own domain — a single-flag link
    /// receives its own domain's figure rather than the combined weighted one, which would
    /// disclose the other domain's adherence by inference.
    /// </summary>
    public decimal CompliancePercent { get; set; }

    /// <summary>
    /// Total number of meals planned in the date range, or <c>null</c> when the caller's link
    /// does not grant the nutrition domain.
    /// </summary>
    public int? MealsPlanned { get; set; }

    /// <summary>
    /// Total number of meals logged in the date range, or <c>null</c> when the caller's link
    /// does not grant the nutrition domain.
    /// </summary>
    public int? MealsLogged { get; set; }

    /// <summary>
    /// Current streak of consecutive compliant days, computed over the caller's own domain.
    /// </summary>
    public int CurrentStreak { get; set; }

    /// <summary>
    /// Average daily macronutrient totals for the date range, or <c>null</c> when the caller's
    /// link does not grant the nutrition domain.
    /// </summary>
    public NutrientTotals? AverageDailyMacros { get; set; }

    /// <summary>
    /// Start date of the progress calculation range.
    /// </summary>
    public DateTime From { get; set; }

    /// <summary>
    /// End date of the progress calculation range.
    /// </summary>
    public DateTime To { get; set; }
}
