using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Service for calculating nutrition plan compliance metrics.
/// </summary>
public interface IComplianceService
{
    /// <summary>
    /// Calculates the compliance score for a client over a date range.
    /// Compliance = (meals logged / meals planned) * 100.
    /// </summary>
    /// <param name="clientId">The client's ApplicationUser.Id.</param>
    /// <param name="from">Start date (inclusive).</param>
    /// <param name="to">End date (inclusive).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Compliance result with score and details.</returns>
    Task<ComplianceResult> CalculateComplianceAsync(Guid clientId, DateTime from, DateTime to, CancellationToken ct);

    /// <summary>
    /// Calculates the current streak of consecutive days where at least one meal was logged.
    /// </summary>
    /// <param name="clientId">The client's ApplicationUser.Id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Number of consecutive compliant days.</returns>
    Task<int> CalculateStreakAsync(Guid clientId, CancellationToken ct);

    /// <summary>
    /// Calculates average daily macros consumed over a date range.
    /// </summary>
    /// <param name="clientId">The client's ApplicationUser.Id.</param>
    /// <param name="from">Start date (inclusive).</param>
    /// <param name="to">End date (inclusive).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Average daily nutrient totals.</returns>
    Task<NutrientTotals> CalculateAverageMacrosAsync(Guid clientId, DateTime from, DateTime to, CancellationToken ct);
}

/// <summary>
/// Result of a compliance calculation.
/// </summary>
public class ComplianceResult
{
    /// <summary>
    /// Combined compliance percentage (0-100), weighted by plan presence.
    /// When both nutrition and training plans are active:
    ///   (mealsPlanned * nutritionPercent + trainingsPlanned * trainingPercent) / (mealsPlanned + trainingsPlanned).
    /// When only one plan type is active, equals that plan's individual percentage.
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
    /// Nutrition-only compliance percentage (0-100).
    /// </summary>
    public decimal NutritionCompliancePercent { get; set; }

    /// <summary>
    /// Total number of training sessions planned in the date range.
    /// A "planned" session is one in a published week that falls on a day within [from, to].
    /// </summary>
    public int TrainingsPlanned { get; set; }

    /// <summary>
    /// Number of planned sessions where every exercise in the session has a completion record for that day.
    /// </summary>
    public int TrainingsCompleted { get; set; }

    /// <summary>
    /// Training-only compliance percentage (0-100).
    /// </summary>
    public decimal TrainingCompliancePercent { get; set; }
}
