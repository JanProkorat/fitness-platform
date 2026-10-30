using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Short-lived record of a meal a plan save removed, kept so an offline "eaten" mark for it can
/// still be answered with a <c>MealRemoved</c> conflict instead of a 404.
/// </summary>
public class RemovedPlanMeal
{
    /// <summary>
    /// Id of the removed meal.
    /// </summary>
    [BsonElement("mealId")]
    public Guid MealId { get; set; }

    /// <summary>
    /// Kind of the removed meal.
    /// </summary>
    [BsonElement("kind")]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public MealKind Kind { get; set; }

    /// <summary>
    /// Week number the meal sat in.
    /// </summary>
    [BsonElement("weekNumber")]
    public int WeekNumber { get; set; }

    /// <summary>
    /// Day of week (as stored on the plan day) the meal sat in.
    /// </summary>
    [BsonElement("dayOfWeek")]
    public int DayOfWeek { get; set; }

    /// <summary>
    /// The plan <c>Version</c> produced by the save that removed the meal.
    /// </summary>
    [BsonElement("removedAtPlanVersion")]
    public int RemovedAtPlanVersion { get; set; }

    /// <summary>
    /// When the meal was removed (UTC).
    /// </summary>
    [BsonElement("removedAt")]
    public DateTime RemovedAt { get; set; }
}
