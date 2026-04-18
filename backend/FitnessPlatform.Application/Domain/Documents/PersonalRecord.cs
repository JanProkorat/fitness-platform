using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB document recording a client's personal record for a specific exercise.
/// One document is created each time a client exceeds their previous best weight
/// (or, on a weight tie, their previous best reps) for a given exercise.
/// </summary>
public class PersonalRecord
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
    /// The client who achieved this personal record (matches ApplicationUser.PublicId).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// Reference to the exercise document's ExternalId (as string for compound index clarity).
    /// </summary>
    [BsonElement("exerciseExternalId")]
    public Guid ExerciseExternalId { get; set; }

    /// <summary>
    /// Snapshot of the exercise name at the time the PR was achieved.
    /// Denormalized for fast reads without a JOIN.
    /// </summary>
    [BsonElement("exerciseName")]
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>
    /// Weight lifted in kilograms. Stored as Decimal128 to avoid IEEE-754 precision loss.
    /// </summary>
    [BsonElement("weightKg")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal WeightKg { get; set; }

    /// <summary>
    /// Repetitions completed in the PR set.
    /// </summary>
    [BsonElement("reps")]
    public int Reps { get; set; }

    /// <summary>
    /// When the personal record was achieved (UTC, taken from WorkoutSet.CompletedAt).
    /// </summary>
    [BsonElement("achievedAt")]
    public DateTime AchievedAt { get; set; }

    /// <summary>
    /// ExternalId of the WorkoutLog that contains this PR set.
    /// Used for the idempotency guard on (WorkoutLogId, ExerciseExternalId, SetNumber).
    /// </summary>
    [BsonElement("workoutLogId")]
    public Guid WorkoutLogId { get; set; }

    /// <summary>
    /// 1-based set number within the exercise that achieved the PR.
    /// Part of the idempotency guard triple.
    /// </summary>
    [BsonElement("setNumber")]
    public int SetNumber { get; set; }

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;

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
