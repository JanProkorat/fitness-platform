using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// An ordered section within a training session (e.g. "Warm-up", "Hlavní", "Cool-down").
/// Embedded sub-document inside <see cref="TrainingSession.Sections"/>.
/// </summary>
public class TrainingSection
{
    /// <summary>
    /// Client-side stable identifier for this section.
    /// </summary>
    [BsonElement("sectionId")]
    public Guid SectionId { get; set; }

    /// <summary>
    /// Display order within the session (0-based).
    /// </summary>
    [BsonElement("order")]
    public int Order { get; set; }

    /// <summary>
    /// Display name of the section (e.g. "Hlavní", "Warm-up").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Workout format for this section. Null means the section inherits the session-level format.
    /// </summary>
    [BsonElement("format")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// Format configuration for this section. Null when Format is null or Standard.
    /// </summary>
    [BsonElement("formatConfig")]
    [BsonIgnoreIfNull]
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Exercises in this section.
    /// </summary>
    [BsonElement("exercises")]
    public List<SessionExercise> Exercises { get; set; } = [];
}
