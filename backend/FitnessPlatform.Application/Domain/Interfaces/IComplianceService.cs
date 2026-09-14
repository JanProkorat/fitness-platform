using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

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
    /// Calculates the current streak of consecutive compliant days for both nutrition and training plans.
    /// Equivalent to calling <see cref="CalculateStreakAsync(Guid, ComplianceDiscipline, CancellationToken)"/>
    /// with <see cref="ComplianceDiscipline.Both"/>.
    /// </summary>
    /// <param name="clientId">The client's ApplicationUser.Id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Number of consecutive compliant days.</returns>
    Task<int> CalculateStreakAsync(Guid clientId, CancellationToken ct);

    /// <summary>
    /// Calculates the current streak of consecutive compliant days, restricted to the
    /// plan types indicated by <paramref name="discipline"/>.
    /// </summary>
    /// <param name="clientId">The client's ApplicationUser.Id.</param>
    /// <param name="discipline">Which plan types to include in the streak calculation.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Number of consecutive compliant days.</returns>
    Task<int> CalculateStreakAsync(Guid clientId, ComplianceDiscipline discipline, CancellationToken ct);

    /// <summary>
    /// Calculates the current streak of consecutive compliant days for both nutrition and
    /// training plans, anchored on a caller-supplied "today" instead of
    /// <see cref="DateTime.UtcNow"/> (#935). Callers that have already resolved the client's
    /// local calendar day (see <c>ClientLocalDateResolver</c>) pass it here so the streak walk
    /// starts from the client's local "today" rather than the server's UTC day — a completion
    /// recorded in the two-hour skew window near local midnight must extend the streak for the
    /// local day the Today card is showing, not the previous UTC day.
    /// </summary>
    /// <param name="clientId">The client's ApplicationUser.Id.</param>
    /// <param name="today">The client's resolved local calendar date to anchor the walk-back on.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Number of consecutive compliant days.</returns>
    Task<int> CalculateStreakAsync(Guid clientId, DateOnly today, CancellationToken ct);

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
