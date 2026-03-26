using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single training session within a week (e.g. "Push Day", "Leg Day").
/// </summary>
public class TrainingSession
{
    /// <summary>
    /// Unique identifier for this session within the plan.
    /// </summary>
    [BsonElement("sessionId")]
    public Guid SessionId { get; set; }

    /// <summary>
    /// Day of the week (1 = Monday, 7 = Sunday).
    /// </summary>
    [BsonElement("dayOfWeek")]
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Display name (e.g. "Push Day", "Upper Body").
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Display order within the day (1-based).
    /// </summary>
    [BsonElement("order")]
    public int Order { get; set; }

    /// <summary>
    /// Optional coach notes for this session.
    /// </summary>
    [BsonElement("notes")]
    [BsonIgnoreIfNull]
    public string? Notes { get; set; }

    /// <summary>
    /// Exercises in this session.
    /// </summary>
    [BsonElement("exercises")]
    public List<SessionExercise> Exercises { get; set; } = [];
}
