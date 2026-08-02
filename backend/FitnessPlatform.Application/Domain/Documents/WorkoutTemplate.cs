using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB root aggregate for a reusable training section template.
/// Belongs to a specific trainer; not shared across tenants.
/// </summary>
public class WorkoutTemplate
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
    /// The trainer who owns this template. Used for per-trainer isolation on every query.
    /// </summary>
    [BsonElement("ownerTrainerId")]
    public Guid OwnerTrainerId { get; set; }

    /// <summary>
    /// Display name of the template (e.g. "Warm-up", "AMRAP Finisher").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional coach notes describing the workout as a whole.
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Default workout format for sections created from this template.
    /// Null means no format override (Standard / inherits from session).
    /// </summary>
    [BsonElement("defaultFormat")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public WorkoutFormat? DefaultFormat { get; set; }

    /// <summary>
    /// Default format configuration. Null when DefaultFormat is null or Standard.
    /// </summary>
    [BsonElement("defaultFormatConfig")]
    [BsonIgnoreIfNull]
    public WodConfig? DefaultFormatConfig { get; set; }

    /// <summary>
    /// Default exercises to pre-populate when applying this template.
    /// </summary>
    [BsonElement("defaultExercises")]
    public List<SessionExercise> DefaultExercises { get; set; } = [];

    /// <summary>
    /// UTC timestamp when this document was created.
    /// </summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// UTC timestamp when this document was last updated.
    /// </summary>
    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}
