using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientNutrition.Shared;

/// <summary>
/// Maps a calendar date to the plan day scheduled for it, using the same rule as the
/// today-log endpoint: week from days since the plan start (falling back to the last published
/// week), day at the index within that week.
/// </summary>
internal static class NutritionPlanDayResolver
{
    /// <summary>
    /// Returns the plan day for <paramref name="dateUtc"/> (UTC midnight of the client-local date),
    /// or null when the plan has no start date, no published week, or the date is before the start.
    /// </summary>
    public static PlanDay? Resolve(NutritionPlan plan, DateTime dateUtc)
    {
        if (!plan.StartDate.HasValue)
        {
            return null;
        }

        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .ToList();

        if (publishedWeeks.Count == 0)
        {
            return null;
        }

        var daysSinceStart = (int)(dateUtc.Date - plan.StartDate.Value.Date).TotalDays;
        if (daysSinceStart < 0)
        {
            return null;
        }

        var weekNumber = daysSinceStart / 7 + 1;
        var dayIndex = daysSinceStart % 7;
        var week = publishedWeeks.FirstOrDefault(w => w.WeekNumber == weekNumber) ?? publishedWeeks[^1];

        return dayIndex < week.Days.Count ? week.Days[dayIndex] : null;
    }

    /// <summary>
    /// Returns the meal with <paramref name="mealId"/> on the plan day for <paramref name="dateUtc"/>, or null.
    /// </summary>
    public static PlanMeal? FindMeal(NutritionPlan plan, DateTime dateUtc, Guid mealId) =>
        Resolve(plan, dateUtc)?.Meals.FirstOrDefault(m => m.MealId == mealId);
}
