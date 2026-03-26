using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing an exercise in the exercise database.
/// </summary>
[BsonIgnoreExtraElements]
public class Exercise
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>
    /// Public-facing identifier used in API requests and responses.
    /// </summary>
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <summary>
    /// Canonical name of the exercise.
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Localized exercise names (en, cs, de) for multi-language support.
    /// </summary>
    [BsonElement("localizedNames")]
    [BsonIgnoreIfNull]
    public LocalizedNames? LocalizedNames { get; set; }

    /// <summary>
    /// Optional description of the exercise.
    /// </summary>
    [BsonElement("description")]
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    /// <summary>
    /// Target muscle groups. First element is the primary muscle group.
    /// </summary>
    [BsonElement("muscleGroups")]
    public List<MuscleGroup> MuscleGroups { get; set; } = [];

    /// <summary>
    /// Equipment required for the exercise.
    /// </summary>
    [BsonElement("equipment")]
    public ExerciseEquipment Equipment { get; set; }

    /// <summary>
    /// Category of the exercise.
    /// </summary>
    [BsonElement("category")]
    public ExerciseCategory Category { get; set; }

    /// <summary>
    /// Difficulty level of the exercise.
    /// </summary>
    [BsonElement("difficulty")]
    public ExerciseDifficulty Difficulty { get; set; }

    /// <summary>
    /// URL to the exercise demonstration video in blob storage.
    /// </summary>
    [BsonElement("videoUrl")]
    [BsonIgnoreIfNull]
    public string? VideoUrl { get; set; }

    /// <summary>
    /// URL to the video thumbnail image.
    /// </summary>
    [BsonElement("thumbnailUrl")]
    [BsonIgnoreIfNull]
    public string? ThumbnailUrl { get; set; }

    /// <summary>
    /// Technique notes in Markdown format.
    /// </summary>
    [BsonElement("techniqueNotes")]
    [BsonIgnoreIfNull]
    public string? TechniqueNotes { get; set; }

    /// <summary>
    /// Whether this is a custom exercise created by a trainer.
    /// </summary>
    [BsonElement("isCustom")]
    public bool IsCustom { get; set; }

    /// <summary>
    /// The trainer who created this custom exercise, if applicable.
    /// </summary>
    [BsonElement("trainerId")]
    [BsonIgnoreIfNull]
    public Guid? TrainerId { get; set; }

    /// <summary>
    /// Soft-delete flag. When true, the exercise is hidden from search results.
    /// </summary>
    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Data source: "system" or "custom".
    /// </summary>
    [BsonElement("source")]
    public string Source { get; set; } = "system";

    /// <summary>
    /// When this document was created.
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }
}
