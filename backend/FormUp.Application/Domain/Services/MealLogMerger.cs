using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// Collapses meal-log rows into one derived state per plan meal per day, so every coach reader
/// reads partly eaten meals the same way the client's own log does.
/// </summary>
public static class MealLogMerger
{
    /// <summary>
    /// The client-local day a row belongs to: <see cref="MealLog.LogDate"/>, or the
    /// <see cref="MealLog.EatenAt"/> date for legacy rows without one.
    /// </summary>
    public static DateTime DayOf(MealLog row) =>
        (row.LogDate != default ? row.LogDate : row.EatenAt ?? default).Date;

    /// <summary>
    /// <see cref="Merge"/> for rows of a single, fully loaded plan.
    /// </summary>
    public static List<MergedMealLog> MergeForPlan(IEnumerable<MealLog> rows, NutritionPlan plan) =>
        Merge(rows, (_, day, mealId) => NutritionPlanDayResolver.FindMeal(plan, day, mealId));

    /// <summary>
    /// Groups rows by plan, day and meal, and derives each group's state and eaten share against the
    /// live plan meal returned by <paramref name="findMeal"/> (plan id, day, meal id).
    /// </summary>
    public static List<MergedMealLog> Merge(IEnumerable<MealLog> rows, Func<Guid, DateTime, Guid, PlanMeal?> findMeal) =>
        rows
            .GroupBy(row => (row.PlanId, Day: DayOf(row), row.MealId))
            .Select(group =>
            {
                var meal = findMeal(group.Key.PlanId, group.Key.Day, group.Key.MealId);
                var groupRows = group.ToList();
                var eatenIds = groupRows.SelectMany(row => MealItemEatenState.EffectiveEatenIds(row, meal)).ToHashSet();
                var markedEaten = groupRows.Any(row => row.EatenAt.HasValue);
                var items = MealItemEatenState.ItemIds(groupRows, meal);
                var state = MealItemEatenState.StateOf(items, eatenIds, markedEaten);
                var share = state switch
                {
                    MealEatenState.Eaten => 1m,
                    MealEatenState.NotEaten => 0m,
                    _ => MealItemEatenState.EatenShare(items, eatenIds, markedEaten),
                };
                DateTime? eatenAt = state == MealEatenState.Eaten
                    ? groupRows.Where(row => row.EatenAt.HasValue).Select(row => row.EatenAt).Min()
                    : null;

                return new MergedMealLog(
                    group.Key.PlanId, group.Key.Day, group.Key.MealId, meal, eatenIds, state, share, eatenAt, groupRows,
                    MealItemEatenState.SnapshotTotals(MealItemEatenState.SnapshotOf(groupRows), eatenIds));
            })
            .ToList();
}
