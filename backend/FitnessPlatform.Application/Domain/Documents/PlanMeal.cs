using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single meal within a plan day (e.g. Breakfast, Lunch).
/// </summary>
public class PlanMeal
{
    /// <summary>
    /// Unique identifier for this meal within the plan.
    /// </summary>
    [BsonElement("mealId")]
    public Guid MealId { get; set; }

    /// <summary>
    /// Kind of meal (Breakfast, Lunch, Dinner, etc.).
    /// </summary>
    [BsonElement("kind")]
    [BsonRepresentation(BsonType.String)]
    public MealKind Kind { get; set; }

    /// <summary>
    /// Display order within the day (1-based).
    /// </summary>
    [BsonElement("order")]
    public int Order { get; set; }

    /// <summary>
    /// Suggested time for the meal (e.g. "08:00").
    /// </summary>
    [BsonElement("time")]
    public string? Time { get; set; }

    /// <summary>
    /// Foods included in this meal.
    /// </summary>
    [BsonElement("foods")]
    public List<MealFood> Foods { get; set; } = [];

    /// <summary>
    /// Recipes included in this meal.
    /// </summary>
    [BsonElement("recipes")]
    public List<MealRecipe> Recipes { get; set; } = [];

    /// <summary>
    /// Optional note for this meal.
    /// </summary>
    [BsonElement("note")]
    [BsonIgnoreIfNull]
    public string? Note { get; set; }

    /// <summary>
    /// Computed totals for this meal.
    /// </summary>
    [BsonElement("mealTotals")]
    public NutrientTotals? MealTotals { get; set; }
}
