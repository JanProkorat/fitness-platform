using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document representing a private note written by a trainer about a client.
/// Notes are never exposed to the client — only the authoring trainer can read/edit/delete them.
/// </summary>
public class TrainerNote
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
    /// The client this note is about (matches ClientProfile.PublicId / ApplicationUser.Id).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// The trainer who authored this note (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("trainerId")]
    public Guid TrainerId { get; set; }

    /// <summary>
    /// The note body. Maximum 2000 characters.
    /// </summary>
    [BsonElement("text")]
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the document was created.
    /// </summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// UTC timestamp when the document was last updated.
    /// </summary>
    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
