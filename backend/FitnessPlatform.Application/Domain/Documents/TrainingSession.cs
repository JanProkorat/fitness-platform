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
    /// Workouts in this session. Each workout contains its own exercises.
    /// The legacy flat <c>exercises</c> field (pre-workouts documents) was retired by the
    /// one-time boot migration in <c>MongoIndexInitializer</c> (#837) — every document now
    /// carries this field populated, so no read-time backfill is required or performed.
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
    /// Named <c>StandaloneExercises</c> in C# — not <c>Exercises</c> — to avoid colliding with
    /// the existing computed <see cref="Exercises"/> flat-view convenience below (used
    /// pervasively by completion-tracking endpoints for "every exercise in this session"). The
    /// wire/BSON element name is still <c>exercises</c> via <see cref="JsonPropertyNameAttribute"/>
    /// and <see cref="BsonElementAttribute"/>, matching the issue's <c>exercises[]</c> naming and
    /// <see cref="PlanMeal"/>'s field-naming convention exactly.
    /// </remarks>
    [BsonElement("exercises")]
    [JsonPropertyName("exercises")]
    public List<SessionExercise> StandaloneExercises { get; set; } = [];

    /// <summary>
    /// Flat view of every exercise in this session — the standalone <see cref="StandaloneExercises"/>
    /// plus every workout's nested exercises. Read-only convenience accessor used by completion-
    /// tracking endpoints for "how many exercises does this session have". Not stored in MongoDB
    /// and not part of the API contract — web/mobile derive their own flattened view client-side.
    /// </summary>
    [BsonIgnore]
    [JsonIgnore]
    public IReadOnlyList<SessionExercise> Exercises =>
        StandaloneExercises.Concat(Workouts.SelectMany(w => w.Exercises)).ToList();
}
