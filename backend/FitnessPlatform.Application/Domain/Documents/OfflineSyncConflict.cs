using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Records that an offline-synced client action collided with a plan change the coach made
/// after the client's snapshot. The client's action is still applied; this document tells the coach.
/// </summary>
public class OfflineSyncConflict
{
    /// <summary>MongoDB internal identifier.</summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>Public identifier; also stored as the dedupe record's result id for replays.</summary>
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <summary>The client who synced the action (ApplicationUser.Id).</summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>External id of the plan the conflict belongs to.</summary>
    [BsonElement("planId")]
    public Guid PlanId { get; set; }

    /// <summary>The coach who authored that plan (ApplicationUser.Id).</summary>
    [BsonElement("planAuthorId")]
    public Guid PlanAuthorId { get; set; }

    /// <summary>Name of the synced operation, e.g. <c>LogMealEaten</c>.</summary>
    [BsonElement("operation")]
    public string Operation { get; set; } = string.Empty;

    /// <summary>Why the action collided with the plan.</summary>
    [BsonElement("kind")]
    [BsonRepresentation(BsonType.String)]
    public OfflineSyncConflictKind Kind { get; set; }

    /// <summary>The meal the client acted on.</summary>
    [BsonElement("mealId")]
    public Guid MealId { get; set; }

    /// <summary>When the client performed the action offline (UTC).</summary>
    [BsonElement("occurredAt")]
    public DateTime OccurredAt { get; set; }

    /// <summary>The client's local calendar day of the action.</summary>
    [BsonElement("logDate")]
    public DateTime LogDate { get; set; }

    /// <summary>The plan version the client saw.</summary>
    [BsonElement("basedOnPlanVersion")]
    public int BasedOnPlanVersion { get; set; }

    /// <summary>The plan version at sync time.</summary>
    [BsonElement("currentPlanVersion")]
    public int CurrentPlanVersion { get; set; }

    /// <summary>The meal's change marker at sync time, when it had one.</summary>
    [BsonElement("mealChangedAtPlanVersion")]
    [BsonIgnoreIfNull]
    public int? MealChangedAtPlanVersion { get; set; }

    /// <summary>Plan name at sync time.</summary>
    [BsonElement("planName")]
    public string PlanName { get; set; } = string.Empty;

    /// <summary>Meal kind at sync time.</summary>
    [BsonElement("mealKind")]
    [BsonRepresentation(BsonType.String)]
    public MealKind MealKind { get; set; }

    /// <summary>Whether a meal log was written for the action (false when the meal was removed).</summary>
    [BsonElement("mealLogged")]
    public bool MealLogged { get; set; }

    /// <summary>UTC time the conflict was detected.</summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;

    /// <summary>Optimistic concurrency version.</summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;
}
