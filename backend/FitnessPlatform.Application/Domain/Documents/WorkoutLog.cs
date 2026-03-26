using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document recording a client's completed workout session.
/// </summary>
public class WorkoutLog
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
    /// The client who performed the workout (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// Reference to the training plan's ExternalId.
    /// </summary>
    [BsonElement("planId")]
    [BsonIgnoreIfNull]
    public Guid? PlanId { get; set; }

    /// <summary>
    /// Reference to the TrainingSession's SessionId within the plan.
    /// </summary>
    [BsonElement("sessionId")]
    [BsonIgnoreIfNull]
    public Guid? SessionId { get; set; }

    /// <summary>
    /// When the workout was started.
    /// </summary>
    [BsonElement("startedAt")]
    public DateTime StartedAt { get; set; }

    /// <summary>
    /// When the workout was completed. Null if still in progress.
    /// </summary>
    [BsonElement("completedAt")]
    [BsonIgnoreIfNull]
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Client's subjective mood rating (1-5). Null if not provided.
    /// </summary>
    [BsonElement("mood")]
    [BsonIgnoreIfNull]
    public int? Mood { get; set; }

    /// <summary>
    /// Optional client notes about the workout.
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Whether this workout has been completed.
    /// </summary>
    [BsonElement("isCompleted")]
    public bool IsCompleted { get; set; }

    /// <summary>
    /// Exercises performed in this workout.
    /// </summary>
    [BsonElement("exercises")]
    public List<WorkoutExercise> Exercises { get; set; } = [];

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
