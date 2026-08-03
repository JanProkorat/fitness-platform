using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a reusable full-session template — a full training-session
/// skeleton (workouts + exercises + prescriptions) that a trainer can copy into a client's
/// <see cref="TrainingPlan"/>. Reuses the same embedded <see cref="TrainingWorkout"/> /
/// <see cref="SessionExercise"/> / <see cref="ExerciseSet"/> docs as training sessions so a
/// template copies verbatim into a plan.
/// </summary>
public class SessionTemplate
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
    /// Ordered workouts making up the template.
    /// </summary>
    [BsonElement("workouts")]
    public List<TrainingWorkout> Workouts { get; set; } = [];

    /// <summary>
    /// Visibility level controlling who can access this template.
    /// Public templates are visible to all trainers; private ones only to their creator.
    /// </summary>
    [BsonElement("visibility")]
    [BsonRepresentation(BsonType.String)]
    public WorkoutTemplateVisibility Visibility { get; set; } = WorkoutTemplateVisibility.Public;

    /// <summary>
    /// When this document was created.
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}
