using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Computes the on-track verdict and supporting signals for a single client.
/// </summary>
public interface IClientVerdictService
{
    /// <summary>
    /// Calculates the verdict and all dashboard signals for the given client.
    /// </summary>
    /// <param name="clientUserId">
    /// The client's <c>ApplicationUser.Id</c> (Guid) — used for MongoDB queries
    /// (WorkoutLog, MealLog, NutritionPlan, TrainingPlan, PersonalRecord).
    /// </param>
    /// <param name="clientProfileId">
    /// The client's <c>ClientProfile.Id</c> (long) — used for PostgreSQL queries
    /// (BodyMeasurement is keyed on ClientProfileId).
    /// </param>
    /// <param name="targetWeightKg">
    /// The client's target weight in kg from onboarding, or null if not set.
    /// </param>
    /// <param name="capabilities">
    /// What the caller's link to this client permits them to see. Required, not optional: the
    /// itemised per-domain signals (training frequency, personal-record count, nutrition
    /// compliance) are suppressed for a caller whose link denies that domain, and a caller that
    /// forgot to pass its capabilities would otherwise silently receive all of them.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A <see cref="ClientVerdictResult"/> reduced to the domains <paramref name="capabilities"/>
    /// grants. The itemised signals (training frequency, personal-record count, nutrition
    /// compliance) are populated only for a visible domain, and the
    /// <see cref="ClientVerdictResult.Verdict"/> scalar itself is computed only from the visible
    /// domains — a caller whose link denies a domain never sees that domain's influence on the
    /// headline verdict, because the underlying read for a denied domain is skipped rather than
    /// computed and filtered afterward. Weight (<see cref="ClientVerdictResult.WeightDeltaToGoal"/>,
    /// <see cref="ClientVerdictResult.WeightDirection"/>) and
    /// <see cref="ClientVerdictResult.LastActiveAt"/> remain dual-readable and always contribute:
    /// body measurements are standalone entries, not data attached to a nutrition or training item.
    /// </returns>
    Task<ClientVerdictResult> ComputeAsync(
        Guid clientUserId,
        long clientProfileId,
        decimal? targetWeightKg,
        LinkCapabilities capabilities,
        CancellationToken ct);
}

/// <summary>
/// Computed signals and verdict for a single client.
/// </summary>
public class ClientVerdictResult
{
    /// <summary>Overall on-track verdict.</summary>
    public ClientVerdict Verdict { get; set; }

    /// <summary>
    /// Nutrition plan compliance percent (0-100), or null when no active nutrition plan exists.
    /// Uses NutritionCompliancePercent only — never the combined CompliancePercent which collapses
    /// to 0 when no plan is active.
    /// </summary>
    public decimal? CompliancePercent { get; set; }

    /// <summary>
    /// Delta between the client's current weight and their target weight, in kg.
    /// Null when no measurements exist or no target weight is set.
    /// </summary>
    public decimal? WeightDeltaToGoal { get; set; }

    /// <summary>Weight direction relative to the target.</summary>
    public WeightDirection WeightDirection { get; set; } = WeightDirection.Stable;

    /// <summary>
    /// Number of distinct workout log sessions completed in the current ISO week
    /// (Monday–Sunday). Null when no active training plan exists.
    /// </summary>
    public int? TrainingFrequencyActual { get; set; }

    /// <summary>
    /// Number of sessions prescribed per week in the active training plan's current
    /// published week. Null when no active training plan exists.
    /// </summary>
    public int? TrainingFrequencyPrescribed { get; set; }

    /// <summary>
    /// UTC timestamp of the most recent activity (workout log, meal log, or measurement).
    /// Null when no activity exists.
    /// </summary>
    public DateTime? LastActiveAt { get; set; }

    /// <summary>
    /// Number of personal records achieved in the current calendar month, or <c>null</c> when the
    /// caller's link does not grant the training domain.
    /// </summary>
    public int? PrCountThisMonth { get; set; }
}
