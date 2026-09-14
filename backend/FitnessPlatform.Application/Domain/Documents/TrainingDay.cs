using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single day within a training week (1 = Monday … 7 = Sunday). Every
/// <see cref="TrainingWeek"/> materialises all 7 days, always — a rest day is a day with
/// no sessions, mirroring <see cref="PlanDay"/> on the nutrition side.
/// </summary>
public class TrainingDay
{
    /// <summary>
    /// Day of the week (1 = Monday, 7 = Sunday).
    /// </summary>
    [BsonElement("dayOfWeek")]
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Training sessions scheduled for this day, ordered by <see cref="TrainingSession.Order"/>.
    /// </summary>
    [BsonElement("sessions")]
    public List<TrainingSession> Sessions { get; set; } = [];

    /// <summary>
    /// Optional coach note for this day.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }
}
