namespace FitnessPlatform.Application.Features.WorkoutLogs.Shared;

/// <summary>
/// Per-set actual values + snapshot-planned values + backend-computed isModified flag,
/// sourced from a <see cref="FitnessPlatform.Application.Domain.Documents.WorkoutSet"/>.
/// Used by training-read endpoints that need to surface actual-vs-planned comparison
/// (GetTodaySession, GetFullTrainingPlan, and the trainer GetTrainingPlan).
/// </summary>
public class LoggedSetDto
{
    /// <summary>1-based set number within the exercise.</summary>
    public int SetNumber { get; set; }

    // ── Actual logged values ────────────────────────────────────────────────────

    /// <summary>Actual repetitions logged. Null when the set has not been performed.</summary>
    public int? ActualReps { get; set; }

    /// <summary>Actual weight (kg) logged. Null when not performed.</summary>
    public decimal? ActualWeightKg { get; set; }

    /// <summary>Actual RPE logged. Null when not performed.</summary>
    public decimal? ActualRpe { get; set; }

    /// <summary>Actual duration (seconds) logged. Null when not performed.</summary>
    public int? ActualDurationSeconds { get; set; }

    /// <summary>Actual distance (meters) logged. Null when not performed.</summary>
    public decimal? ActualDistanceMeters { get; set; }

    // ── Snapshot-planned values ─────────────────────────────────────────────────
    // Frozen at log time from the plan prescription.
    // Null on legacy documents that pre-date snapshot storage — treat as planned == actual.

    /// <summary>Snapshot-planned repetitions at log time. Null for legacy logs.</summary>
    public int? PlannedReps { get; set; }

    /// <summary>Snapshot-planned weight (kg) at log time. Null for legacy logs.</summary>
    public decimal? PlannedWeightKg { get; set; }

    /// <summary>Snapshot-planned RPE at log time. Null for legacy logs.</summary>
    public decimal? PlannedRpe { get; set; }

    /// <summary>Snapshot-planned duration (seconds) at log time. Null for legacy logs.</summary>
    public int? PlannedDurationSeconds { get; set; }

    /// <summary>Snapshot-planned distance (meters) at log time. Null for legacy logs.</summary>
    public decimal? PlannedDistanceMeters { get; set; }

    /// <summary>
    /// Backend-computed flag: true when any actual field differs from its snapshot-planned counterpart.
    /// Always false for legacy sets (no snapshot → treated as planned == actual).
    /// </summary>
    public bool IsModified { get; set; }
}
