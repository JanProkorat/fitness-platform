using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single training session within a week (e.g. "Push Day", "Leg Day").
/// </summary>
public class TrainingSession
{
    /// <summary>
    /// Unique identifier for this session within the plan.
    /// </summary>
    [BsonElement("sessionId")]
    public Guid SessionId { get; set; }

    /// <summary>
    /// Day of the week (1 = Monday, 7 = Sunday).
    /// </summary>
    [BsonElement("dayOfWeek")]
    public int DayOfWeek { get; set; }

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
    /// sections inherit when their own Format is null. Null means Standard.
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
    /// Sections in this session. Each section contains its own exercises.
    /// Schema-on-read: if a stored document has only flat <c>exercises</c> and no <c>sections</c>,
    /// a single default section named "Hlavní" is synthesized via <see cref="WithBackfilledSections"/>.
    /// </summary>
    [BsonElement("sections")]
    public List<TrainingSection> Sections { get; set; } = [];

    /// <summary>
    /// Legacy flat exercises list. Only present in documents written before the sections migration.
    /// Not written on new saves. Used by <see cref="WithBackfilledSections"/> for schema-on-read.
    /// </summary>
    [BsonElement("exercises")]
    [BsonIgnoreIfNull]
    public List<SessionExercise>? LegacyExercises { get; set; }

    /// <summary>
    /// Returns a view of this session with legacy flat-exercise documents backfilled into a default section.
    /// If <see cref="Sections"/> is already populated this is a no-op.
    /// </summary>
    public TrainingSession WithBackfilledSections()
    {
        if (Sections.Count > 0 || LegacyExercises is null || LegacyExercises.Count == 0)
            return this;

        Sections =
        [
            new TrainingSection
            {
                SectionId = Guid.NewGuid(),
                Order = 0,
                Name = "Hlavní",
                Format = null,
                FormatConfig = null,
                Exercises = LegacyExercises
            }
        ];
        LegacyExercises = null;
        return this;
    }

    /// <summary>
    /// Flat view of all exercises across all sections. Read-only convenience accessor.
    /// Not stored in MongoDB — computed from <see cref="Sections"/>.
    /// </summary>
    [BsonIgnore]
    public IReadOnlyList<SessionExercise> Exercises =>
        Sections.SelectMany(s => s.Exercises).ToList();
}
