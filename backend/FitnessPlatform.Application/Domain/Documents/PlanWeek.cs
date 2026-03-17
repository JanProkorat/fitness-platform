using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single week within a nutrition plan.
/// </summary>
public class PlanWeek
{
    /// <summary>
    /// Week number within the plan (1-based).
    /// </summary>
    [BsonElement("weekNumber")]
    public int WeekNumber { get; set; }

    /// <summary>
    /// Days in this week.
    /// </summary>
    [BsonElement("days")]
    public List<PlanDay> Days { get; set; } = [];
}
