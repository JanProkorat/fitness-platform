using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a training plan assigned to a client by a trainer.
/// </summary>
public class TrainingPlan
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
    /// The client this plan belongs to (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// The trainer who created this plan (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("trainerId")]
    public Guid TrainerId { get; set; }

    /// <summary>
    /// Display name of the plan (e.g. "Hypertrophy — March 2026").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the training plan.
    /// </summary>
    [BsonElement("description")]
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    /// <summary>
    /// Current plan status (Draft, Active, Archived).
    /// </summary>
    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public TrainingPlanStatus Status { get; set; } = TrainingPlanStatus.Draft;

    /// <summary>
    /// Weeks in the plan.
    /// </summary>
    [BsonElement("weeks")]
    public List<TrainingWeek> Weeks { get; set; } = [];

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;

    /// <summary>
    /// When this plan was created.
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this plan was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// When this plan was published (status changed to Active).
    /// </summary>
    [BsonElement("datePublished")]
    [BsonIgnoreIfNull]
    public DateTime? DatePublished { get; set; }

    /// <summary>
    /// When this plan was marked as completed by the professional.
    /// </summary>
    [BsonElement("dateCompleted")]
    [BsonIgnoreIfNull]
    public DateTime? DateCompleted { get; set; }

    /// <summary>
    /// The Monday when Week 1 begins. Stored as midnight UTC. Null until set.
    /// </summary>
    [BsonElement("startDate")]
    [BsonIgnoreIfNull]
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// Optional cross-database reference to a QuestionnaireResponse (PostgreSQL PublicId).
    /// Links this plan to the questionnaire the client filled out for this specific plan cycle.
    /// </summary>
    [BsonElement("questionnaireResponseId")]
    [BsonIgnoreIfNull]
    public Guid? QuestionnaireResponseId { get; set; }
}
