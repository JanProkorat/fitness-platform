using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// A single week within a <see cref="NutritionPlanTemplate"/>. Slim compared to
/// <see cref="PlanWeek"/> — carries no <c>Status</c>/<c>DatePublished</c>, which are
/// meaningless outside a client plan.
/// </summary>
public class TemplateWeek
{
    /// <summary>
    /// Week number within the template (1-based).
    /// </summary>
    [BsonElement("weekNumber")]
    public int WeekNumber { get; set; }

    /// <summary>
    /// Days in this week. Reuses <see cref="PlanDay"/> unchanged — everything below the week
    /// level (<see cref="PlanDay"/>, <see cref="PlanMeal"/>, <see cref="MealFood"/>,
    /// <see cref="MealRecipe"/>) is a straight clone between a template and a client plan.
    /// </summary>
    [BsonElement("days")]
    public List<PlanDay> Days { get; set; } = [];
}
