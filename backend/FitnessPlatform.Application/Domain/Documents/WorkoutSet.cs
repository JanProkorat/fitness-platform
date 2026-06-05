using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single set actually performed during a workout with recorded values.
/// Snapshot-planned fields capture the prescribed values at the time the set was first logged;
/// they are immutable after initial persistence so later plan edits do not affect them.
/// </summary>
public class WorkoutSet
{
    /// <summary>
    /// Set number within the exercise (1-based).
    /// </summary>
    [BsonElement("setNumber")]
    public int SetNumber { get; set; }

    /// <summary>
    /// Actual repetitions completed.
    /// </summary>
    [BsonElement("reps")]
    [BsonIgnoreIfNull]
    public int? Reps { get; set; }

    /// <summary>
    /// Actual weight used in kilograms.
    /// </summary>
    [BsonElement("weightKg")]
    [BsonIgnoreIfNull]
    public decimal? WeightKg { get; set; }

    /// <summary>
    /// Rate of Perceived Exertion (1-10 scale).
    /// </summary>
    [BsonElement("rpe")]
    [BsonIgnoreIfNull]
    public decimal? Rpe { get; set; }

    /// <summary>
    /// Actual duration in seconds (for timed exercises).
    /// </summary>
    [BsonElement("durationSeconds")]
    [BsonIgnoreIfNull]
    public int? DurationSeconds { get; set; }

    /// <summary>
    /// Actual distance in meters (for distance-based exercises).
    /// </summary>
    [BsonElement("distanceMeters")]
    [BsonIgnoreIfNull]
    public decimal? DistanceMeters { get; set; }

    /// <summary>
    /// When this set was completed.
    /// </summary>
    [BsonElement("completedAt")]
    [BsonIgnoreIfNull]
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Whether this set is a personal record for this exercise.
    /// </summary>
    [BsonElement("isPR")]
    public bool IsPR { get; set; }

    // ── Snapshot-planned fields ─────────────────────────────────────────────────
    // Frozen at log time from the plan prescription. Null on legacy documents
    // (pre-snapshot) — treated as planned == actual / isModified == false.

    /// <summary>
    /// Prescribed repetitions at the time this set was first logged.
    /// </summary>
    [BsonElement("plannedReps")]
    [BsonIgnoreIfNull]
    public int? PlannedReps { get; set; }

    /// <summary>
    /// Prescribed weight (kg) at the time this set was first logged.
    /// </summary>
    [BsonElement("plannedWeightKg")]
    [BsonIgnoreIfNull]
    public decimal? PlannedWeightKg { get; set; }

    /// <summary>
    /// Prescribed RPE at the time this set was first logged.
    /// </summary>
    [BsonElement("plannedRpe")]
    [BsonIgnoreIfNull]
    public decimal? PlannedRpe { get; set; }

    /// <summary>
    /// Prescribed duration (seconds) at the time this set was first logged.
    /// </summary>
    [BsonElement("plannedDurationSeconds")]
    [BsonIgnoreIfNull]
    public int? PlannedDurationSeconds { get; set; }

    /// <summary>
    /// Prescribed distance (meters) at the time this set was first logged.
    /// </summary>
    [BsonElement("plannedDistanceMeters")]
    [BsonIgnoreIfNull]
    public decimal? PlannedDistanceMeters { get; set; }

    /// <summary>
    /// Backend-computed flag: true when any actual field differs from its snapshot-planned counterpart.
    /// Always false for legacy sets whose planned fields are all null (backward-compatible default).
    /// Never stored — derived on read.
    /// </summary>
    [BsonIgnore]
    public bool IsModified =>
        PlannedReps.HasValue && Reps != PlannedReps ||
        PlannedWeightKg.HasValue && WeightKg != PlannedWeightKg ||
        PlannedRpe.HasValue && Rpe != PlannedRpe ||
        PlannedDurationSeconds.HasValue && DurationSeconds != PlannedDurationSeconds ||
        PlannedDistanceMeters.HasValue && DistanceMeters != PlannedDistanceMeters;
}
