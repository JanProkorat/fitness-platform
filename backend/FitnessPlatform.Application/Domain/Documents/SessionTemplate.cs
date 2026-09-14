using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a reusable full-session template — a full training-session
/// skeleton (workouts + exercises + prescriptions) that a trainer can copy into a client's
/// <see cref="TrainingPlan"/>. Reuses the same embedded <see cref="TrainingWorkout"/> /
/// <see cref="SessionExercise"/> / <see cref="ExerciseSet"/> docs as training sessions so a
/// template copies verbatim into a plan. Participates in the sharing-library contract
/// (<see cref="ILibraryDocument"/>, <c>LibraryAccessGuard</c>, <c>LibrarySearchHelper</c>).
/// </summary>
public class SessionTemplate : ILibraryDocument
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <inheritdoc />
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <summary>
    /// The trainer who owns this template. Seeded system templates use
    /// <see cref="FitnessPlatform.Application.Domain.Constants.SystemUsers.AdminId"/>.
    /// </summary>
    [BsonElement("ownerId")]
    public Guid OwnerId { get; set; }

    /// <summary>
    /// Name of the template.
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Localized template names (en, cs, de) for multi-language support.
    /// </summary>
    [BsonElement("localizedNames")]
    [BsonIgnoreIfNull]
    public LocalizedNames? LocalizedNames { get; set; }

    /// <summary>
    /// Optional description of the template.
    /// </summary>
    [BsonElement("description")]
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    /// <summary>
    /// Difficulty level of the template.
    /// </summary>
    [BsonElement("difficulty")]
    [BsonRepresentation(BsonType.String)]
    public ExerciseDifficulty Difficulty { get; set; }

    /// <summary>
    /// Estimated total duration of the session in minutes.
    /// </summary>
    [BsonElement("estimatedDurationMinutes")]
    [BsonIgnoreIfNull]
    public int? EstimatedDurationMinutes { get; set; }

    /// <summary>
    /// Session-level workout format / scoring methodology.
    /// </summary>
    [BsonElement("format")]
    [BsonRepresentation(BsonType.String)]
    public WorkoutFormat Format { get; set; } = WorkoutFormat.Standard;

    /// <summary>
    /// Format configuration for the session. Null when Format is Standard.
    /// </summary>
    [BsonElement("formatConfig")]
    [BsonIgnoreIfNull]
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Ordered workouts making up the template. Every document is created directly in this
    /// shape — there is no production data predating the workouts model, so no migration or
    /// read-time backfill from a legacy flat <c>exercises</c> field exists or is needed.
    /// </summary>
    [BsonElement("workouts")]
    public List<TrainingWorkout> Workouts { get; set; } = [];

    /// <summary>
    /// Standalone exercises directly on this template — not grouped under any
    /// <see cref="TrainingWorkout"/> (e.g. a single finisher movement that doesn't warrant its
    /// own workout block). Sits alongside <see cref="Workouts"/>, mirroring
    /// <see cref="TrainingSession.StandaloneExercises"/>. Shares one ordering sequence with
    /// <see cref="Workouts"/> — a duplicate <see cref="TrainingWorkout.Order"/>/
    /// <see cref="SessionExercise.Order"/> across the two lists is rejected.
    /// </summary>
    /// <remarks>
    /// Named <c>StandaloneExercises</c> in C# and on the wire — not <c>Exercises</c> — to avoid
    /// colliding with the computed <see cref="AllExercises"/> flat-view convenience below,
    /// mirroring <see cref="TrainingSession.StandaloneExercises"/> exactly. The BSON element name
    /// stays <c>exercises</c> (independent of the wire/JSON name — not part of this contract);
    /// on the wire, <c>exercises</c> is retired from the session shape entirely: this list is
    /// <c>standaloneExercises</c> in both directions, and the flat union below is
    /// <c>allExercises</c>, read-only.
    /// </remarks>
    [BsonElement("exercises")]
    [JsonPropertyName("standaloneExercises")]
    public List<SessionExercise> StandaloneExercises { get; set; } = [];

    /// <summary>
    /// Flat view of every exercise in this template — the standalone <see cref="StandaloneExercises"/>
    /// plus every workout's nested exercises. Computed, never persisted (<see cref="BsonIgnoreAttribute"/>).
    /// Read-only on the wire as <c>allExercises</c> — a client MUST NOT round-trip this field back on
    /// write; the write-side session request has no member for it, so it is structurally ignored, not
    /// rejected, if present in a PUT body.
    /// </summary>
    [BsonIgnore]
    [JsonPropertyName("allExercises")]
    public IReadOnlyList<SessionExercise> AllExercises =>
        StandaloneExercises.Concat(Workouts.SelectMany(w => w.Exercises)).ToList();

    /// <inheritdoc />
    /// <remarks>
    /// No initializer — a field-absent document deserializes to <see cref="LibraryVisibility.Private"/>,
    /// the CLR default and the safe fallback. The already-seeded catalog documents store
    /// <c>"Public"</c> explicitly, so they are unaffected by dropping the previous
    /// <c>= WorkoutTemplateVisibility.Public</c> initializer.
    /// </remarks>
    [BsonElement("visibility")]
    [BsonRepresentation(BsonType.String)]
    public LibraryVisibility Visibility { get; set; }

    /// <inheritdoc />
    /// <remarks>
    /// No initializer — must be set from the injected <c>TimeProvider</c> on create, never from
    /// <c>DateTime.UtcNow</c>.
    /// </remarks>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }

    /// <inheritdoc />
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}
