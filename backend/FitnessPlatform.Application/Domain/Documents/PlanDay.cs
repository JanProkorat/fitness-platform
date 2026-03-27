using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single day within a plan week (1 = Monday … 7 = Sunday).
/// </summary>
public class PlanDay
{
    /// <summary>
    /// Day of the week (1 = Monday, 7 = Sunday).
    /// </summary>
    [BsonElement("dayOfWeek")]
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Meals scheduled for this day.
    /// </summary>
    [BsonElement("meals")]
    public List<PlanMeal> Meals { get; set; } = [];

    /// <summary>
    /// Optional note for this day.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }

    /// <summary>
    /// Computed totals for this day.
    /// </summary>
    [BsonElement("dayTotals")]
    public NutrientTotals? DayTotals { get; set; }
}
