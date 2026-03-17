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
    /// Calculates the current streak of consecutive days with compliance >= 80%.
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
    /// Compliance percentage (0-100).
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
}
