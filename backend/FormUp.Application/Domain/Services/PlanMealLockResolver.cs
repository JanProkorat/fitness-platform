using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// Decides which meals of a plan the coach may no longer change: a meal is locked once the client
/// ate any of it, and once its day is before the client's local today.
/// </summary>
public static class PlanMealLockResolver
{
    /// <summary>
    /// The calendar date of a plan slot, or null when the plan has no start date.
    /// </summary>
    public static DateOnly? DayDate(DateTime? startDate, int weekNumber, int dayOfWeek) =>
        startDate.HasValue
            ? DateOnly.FromDateTime(startDate.Value).AddDays((weekNumber - 1) * 7 + (dayOfWeek - 1))
            : null;

    /// <summary>
    /// Whether the slot's date is before <paramref name="clientToday"/>. A plan without a start date has no past days.
    /// </summary>
    public static bool IsPastDay(DateTime? startDate, int weekNumber, int dayOfWeek, DateOnly clientToday) =>
        DayDate(startDate, weekNumber, dayOfWeek) is { } date && date < clientToday;

    /// <summary>
    /// <see cref="Resolve"/> plus one locked entry for each logged meal that is no longer in the plan,
    /// flagged <see cref="PlanMealLock.IsRemovedFromPlan"/>. For coach reads only: the save path works
    /// on stored meals and must not see these.
    /// </summary>
    public static List<PlanMealLock> ResolveIncludingRemoved(NutritionPlan plan, IReadOnlyCollection<MealLog> logs, DateOnly clientToday)
    {
        var locks = Resolve(plan, logs, clientToday);
        var planMealIds = locks.Select(mealLock => mealLock.Meal.MealId).ToHashSet();

        var removedByMeal = MealLogMerger
            .Merge(logs.Where(log => !planMealIds.Contains(log.MealId)), (_, _, _) => null)
            .Where(merged => merged.State != MealEatenState.NotEaten)
            .GroupBy(merged => merged.MealId)
            .Select(group => group.OrderByDescending(merged => merged.State).ThenByDescending(merged => merged.DayUtc).First());

        foreach (var merged in removedByMeal)
        {
            var kind = merged.Rows.Select(row => row.MealKind).FirstOrDefault(rowKind => rowKind is not null) ?? default;
            var date = DateOnly.FromDateTime(merged.DayUtc);
            var daysSinceStart = plan.StartDate is { } startDate ? (merged.DayUtc.Date - startDate.Date).Days : -1;
            var (weekNumber, dayOfWeek) = daysSinceStart >= 0
                ? (daysSinceStart / 7 + 1, daysSinceStart % 7 + 1)
                : (1, ((int)date.DayOfWeek + 6) % 7 + 1);

            locks.Add(new PlanMealLock(
                new PlanMeal { MealId = merged.MealId, Kind = kind },
                weekNumber,
                dayOfWeek,
                date,
                merged.State == MealEatenState.Eaten ? MealLockState.Eaten : MealLockState.PartlyEaten,
                merged.EatenItemIds.ToList(),
                MealItemEatenState.SnapshotOf(merged.Rows),
                IsRemovedFromPlan: true));
        }

        return locks;
    }

    /// <summary>
    /// One verdict per stored meal. When a meal has log rows on several days, the most eaten state
    /// wins, the latest day on a tie.
    /// </summary>
    public static List<PlanMealLock> Resolve(NutritionPlan plan, IEnumerable<MealLog> logs, DateOnly clientToday)
    {
        var mealsById = plan.Weeks
            .SelectMany(week => week.Days)
            .SelectMany(day => day.Meals)
            .GroupBy(meal => meal.MealId)
            .ToDictionary(group => group.Key, group => group.First());

        var eatenByMeal = MealLogMerger
            .Merge(logs, (_, _, mealId) => mealsById.GetValueOrDefault(mealId))
            .Where(merged => merged.State != MealEatenState.NotEaten)
            .GroupBy(merged => merged.MealId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(merged => merged.State).ThenByDescending(merged => merged.DayUtc).First());

        var locks = new List<PlanMealLock>();

        foreach (var week in plan.Weeks)
        {
            foreach (var day in week.Days)
            {
                foreach (var meal in day.Meals)
                {
                    var date = DayDate(plan.StartDate, week.WeekNumber, day.DayOfWeek);
                    var isPast = date is { } slotDate && slotDate < clientToday;

                    if (eatenByMeal.TryGetValue(meal.MealId, out var merged))
                    {
                        var state = merged.State == MealEatenState.Eaten ? MealLockState.Eaten : MealLockState.PartlyEaten;
                        locks.Add(new PlanMealLock(
                            meal, week.WeekNumber, day.DayOfWeek, date, state,
                            merged.EatenItemIds.ToList(), MealItemEatenState.SnapshotOf(merged.Rows)));
                        continue;
                    }

                    locks.Add(new PlanMealLock(
                        meal, week.WeekNumber, day.DayOfWeek, date,
                        isPast ? MealLockState.Missed : MealLockState.Open,
                        [], null));
                }
            }
        }

        return locks;
    }
}
