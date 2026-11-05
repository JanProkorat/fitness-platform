using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// Lock verdict for one stored plan meal.
/// </summary>
/// <param name="Meal">The stored plan meal.</param>
/// <param name="WeekNumber">Week the meal sits in.</param>
/// <param name="DayOfWeek">Day of the week the meal sits in (1 = Monday).</param>
/// <param name="Date">Calendar date of the slot; null when the plan has no start date.</param>
/// <param name="State">Why the meal is locked, or <see cref="MealLockState.Open"/>.</param>
/// <param name="EatenItemIds">Ids of the meal's items counted as eaten; empty unless the meal is eaten or partly eaten.</param>
/// <param name="EatenSnapshot">Items as they stood when first eaten; null when the meal is open, missed or has no snapshot.</param>
/// <param name="IsRemovedFromPlan">
/// True for a meal the client ate that is no longer in the plan. <paramref name="Meal"/> is then a stub
/// carrying only the id and kind, and the slot comes from the log's day.
/// </param>
public sealed record PlanMealLock(
    PlanMeal Meal,
    int WeekNumber,
    int DayOfWeek,
    DateOnly? Date,
    MealLockState State,
    IReadOnlyCollection<Guid> EatenItemIds,
    IReadOnlyList<EatenMealItem>? EatenSnapshot,
    bool IsRemovedFromPlan = false)
{
    /// <summary>Whether the coach may not edit, move or delete the meal.</summary>
    public bool IsLocked => State != MealLockState.Open;
}
