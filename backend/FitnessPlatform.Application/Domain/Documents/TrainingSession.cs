using System.Text.Json.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single training session within a <see cref="TrainingDay"/> (e.g. "Push Day", "Leg Day").
/// The parent day owns the day-of-week; a session no longer carries its own — see
/// <see cref="TrainingDay.DayOfWeek"/>.
/// </summary>
public class TrainingSession
{
    /// <summary>
    /// Unique identifier for this session within the plan.
    /// </summary>
    [BsonElement("sessionId")]
    public Guid SessionId { get; set; }

    /// <summary>
    /// Display name (e.g. "Push Day", "Upper Body").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Display order within the day (1-based).
    /// </summary>
    [BsonElement("order")]
    public int Order { get; set; }

    /// <summary>
    /// Optional coach notes for this session.
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Session-level workout format. Kept nullable for one release as an inheritable default —
    /// workouts inherit when their own Format is null. Null means Standard.
    /// </summary>
    [BsonElement("format")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// Session-level format configuration. Null when Format is null or Standard.
    /// </summary>
    [BsonElement("formatConfig")]
    [BsonIgnoreIfNull]
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Workouts in this session. Each workout contains its own exercises. Every document is
    /// created directly in this shape — there is no production data predating the workouts
    /// model, so no migration or read-time backfill from a legacy flat <c>exercises</c> field
    /// exists or is needed.
    /// </summary>
    [BsonElement("workouts")]
    public List<TrainingWorkout> Workouts { get; set; } = [];

    /// <summary>
    /// Standalone exercises directly on this session — not grouped under any
    /// <see cref="TrainingWorkout"/> (e.g. a single finisher movement that doesn't warrant its
    /// own workout block). Sits alongside <see cref="Workouts"/>, mirroring how
    /// <see cref="PlanMeal.Foods"/> and <see cref="PlanMeal.Recipes"/> sit side by side (#857
    /// phase 3a). Shares one ordering sequence with <see cref="Workouts"/> — a duplicate
    /// <see cref="TrainingWorkout.Order"/>/<see cref="SessionExercise.Order"/> across the two
    /// lists is rejected by <c>UpdateTrainingPlanValidator</c>.
    /// </summary>
    /// <remarks>
    /// Named <c>StandaloneExercises</c> in C# and on the wire — not <c>Exercises</c> — to avoid
    /// colliding with the computed <see cref="AllExercises"/> flat-view convenience below. The
    /// BSON element name stays <c>exercises</c>, matching the issue's storage-shape naming and
    /// <see cref="PlanMeal"/>'s field-naming convention; the BSON element name is independent of
    /// the wire (JSON) name and is not part of this contract (#874). On the wire, <c>exercises</c>
    /// is retired from the session shape entirely: this list is <c>standaloneExercises</c> in both
    /// directions, and the flat union below is <c>allExercises</c>, read-only.
    /// </remarks>
    [BsonElement("exercises")]
    [JsonPropertyName("standaloneExercises")]
    public List<SessionExercise> StandaloneExercises { get; set; } = [];

    /// <summary>
    /// Flat view of every exercise in this session — the standalone <see cref="StandaloneExercises"/>
    /// plus every workout's nested exercises. Computed, never persisted (<see cref="BsonIgnoreAttribute"/>).
    /// Read-only on the wire as <c>allExercises</c> — a client MUST NOT round-trip this field back on
    /// write; <c>UpdateSessionRequest</c> has no member for it, so it is structurally ignored, not
    /// rejected, if present in a PUT body (#874).
    /// </summary>
    [BsonIgnore]
    [JsonPropertyName("allExercises")]
    public IReadOnlyList<SessionExercise> AllExercises =>
        StandaloneExercises.Concat(Workouts.SelectMany(w => w.Exercises)).ToList();
}
