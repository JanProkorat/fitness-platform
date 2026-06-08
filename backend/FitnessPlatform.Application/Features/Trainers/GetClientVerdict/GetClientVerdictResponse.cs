using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.GetClientVerdict;

public class GetClientVerdictResponse
{
    /// <summary>
    /// Overall on-track verdict for the client.
    /// </summary>
    public ClientVerdict Verdict { get; set; }

    /// <summary>
    /// Nutrition plan compliance percent (0-100), or null when no active nutrition plan.
    /// </summary>
    public decimal? CompliancePercent { get; set; }

    /// <summary>
    /// Delta between current weight and target weight in kg, or null when no measurements/target.
    /// </summary>
    public decimal? WeightDeltaToGoal { get; set; }

    /// <summary>
    /// Direction the client's weight is moving relative to their target.
    /// </summary>
    public WeightDirection WeightDirection { get; set; }

    /// <summary>
    /// Number of workout sessions completed in the current ISO week, or null when no active training plan.
    /// </summary>
    public int? TrainingFrequencyActual { get; set; }

    /// <summary>
    /// Number of sessions prescribed per week in the active training plan, or null when no active training plan.
    /// </summary>
    public int? TrainingFrequencyPrescribed { get; set; }

    /// <summary>
    /// UTC timestamp of the most recent activity (workout log, meal log, or measurement), or null.
    /// </summary>
    public DateTime? LastActiveAt { get; set; }

    /// <summary>
    /// Number of personal records achieved in the current calendar month.
    /// </summary>
    public int PrCountThisMonth { get; set; }
}
