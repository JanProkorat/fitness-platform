using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a nutrition plan assigned to a client by a nutritionist.
/// </summary>
public class NutritionPlan
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
    /// The nutritionist who created this plan (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("nutritionistId")]
    public Guid NutritionistId { get; set; }

    /// <summary>
    /// Display name of the plan (e.g. "Weight Loss — March 2026").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Current plan status (Draft, Active, Archived).
    /// </summary>
    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public NutritionPlanStatus Status { get; set; } = NutritionPlanStatus.Draft;

    /// <summary>
    /// Global daily nutrition targets for the plan.
    /// </summary>
    [BsonElement("globalSettings")]
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// Weeks in the plan.
    /// </summary>
    [BsonElement("weeks")]
    public List<PlanWeek> Weeks { get; set; } = [];

    /// <summary>
    /// Supplement recommendations for this plan.
    /// Coaches manage the list; clients see it read-only and may schedule local reminders.
    /// </summary>
    [BsonElement("supplements")]
    public List<Supplement> Supplements { get; set; } = [];

    /// <summary>
    /// Primary fitness goal for this plan period.
    /// When set, read sites prefer this value over the client's onboarding baseline.
    /// </summary>
    [BsonElement("goal")]
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Target body weight in kilograms for this plan period.
    /// When set, read sites prefer this value over the client's onboarding baseline.
    /// </summary>
    [BsonElement("targetWeightKg")]
    [BsonIgnoreIfNull]
    public decimal? TargetWeightKg { get; set; }

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
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// When this plan was published (status changed to Active).
    /// </summary>
    [BsonElement("datePublished")]
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
