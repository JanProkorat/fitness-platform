using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Records that a client write (identified by a client-generated request id) was applied, so a
/// retried offline-sync request is answered without applying it twice. Expires after 8 days.
/// </summary>
public class ProcessedClientRequest
{
    /// <summary>MongoDB internal identifier.</summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>The client who sent the request (ApplicationUser.Id).</summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>The client-generated request id; unique per client.</summary>
    [BsonElement("clientRequestId")]
    public Guid ClientRequestId { get; set; }

    /// <summary>Name of the operation that was applied, e.g. <c>AddOffPlanFood</c>.</summary>
    [BsonElement("operation")]
    public string Operation { get; set; } = string.Empty;

    /// <summary>The <c>NutritionPlan.Version</c> the client saw when it queued the request.</summary>
    [BsonElement("basedOnPlanVersion")]
    [BsonIgnoreIfNull]
    public int? BasedOnPlanVersion { get; set; }

    /// <summary>Id of the created resource when a replay must return it (entry id, measurement public id).</summary>
    [BsonElement("resultId")]
    [BsonIgnoreIfNull]
    public Guid? ResultId { get; set; }

    /// <summary>UTC time the request was recorded; drives the expiry index.</summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
