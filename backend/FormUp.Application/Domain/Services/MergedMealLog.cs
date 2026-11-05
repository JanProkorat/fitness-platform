using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// All meal-log rows of one plan meal on one day, with the eaten state derived from the live plan meal.
/// </summary>
/// <param name="PlanId">Plan the rows belong to.</param>
/// <param name="DayUtc">Client-local calendar day, at UTC midnight.</param>
/// <param name="MealId">Plan meal id.</param>
/// <param name="Meal">The live plan meal, or null when it can no longer be found.</param>
/// <param name="EatenItemIds">Eaten ids still present in the meal (every item for a legacy eaten row).</param>
/// <param name="State">Derived eaten state.</param>
/// <param name="Share">Eaten share in [0, 1].</param>
/// <param name="EatenAt">Earliest eaten time among the rows, set only when the state is Eaten.</param>
/// <param name="Rows">The merged rows.</param>
public sealed record MergedMealLog(
    Guid PlanId,
    DateTime DayUtc,
    Guid MealId,
    PlanMeal? Meal,
    IReadOnlySet<Guid> EatenItemIds,
    MealEatenState State,
    decimal Share,
    DateTime? EatenAt,
    IReadOnlyList<MealLog> Rows);
