using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
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
    /// Publish status of this week (Draft or Published).
    /// </summary>
    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public WeekStatus Status { get; set; } = WeekStatus.Draft;

    /// <summary>
    /// When this week was published (status changed to Published).
    /// </summary>
    [BsonElement("datePublished")]
    public DateTime? DatePublished { get; set; }

    /// <summary>
    /// Days in this week.
    /// </summary>
    [BsonElement("days")]
    public List<PlanDay> Days { get; set; } = [];
}
