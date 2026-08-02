using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// An ordered section within a workout log — mirrors <see cref="TrainingWorkout"/> but
/// contains completed <see cref="WorkoutExercise"/> entries instead of planned ones.
/// Embedded sub-document inside <see cref="WorkoutLog.Sections"/>.
/// </summary>
public class WorkoutSection
{
    /// <summary>
    /// Stable identifier matching the source <see cref="TrainingWorkout.SectionId"/>.
    /// </summary>
    [BsonElement("sectionId")]
    public Guid SectionId { get; set; }

    /// <summary>
    /// Display order within the workout (0-based).
    /// </summary>
    [BsonElement("order")]
    public int Order { get; set; }

    /// <summary>
    /// Display name of the section (e.g. "Hlavní", "Warm-up").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// WOD format for this section. Null means section inherits the session-level format.
    /// </summary>
    [BsonElement("format")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public WorkoutFormat? Format { get; set; }

    /// <summary>
    /// WOD format result for this section (e.g. ForTime total, AMRAP rounds).
    /// Null for Standard sections or when not yet recorded.
    /// </summary>
    [BsonElement("wodResult")]
    [BsonIgnoreIfNull]
    public WodResult? WodResult { get; set; }

    /// <summary>
    /// Exercises completed in this section.
    /// </summary>
    [BsonElement("exercises")]
    public List<WorkoutExercise> Exercises { get; set; } = [];
}
