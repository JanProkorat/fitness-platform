using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Counts the meals a nutrition plan schedules for a calendar date.
/// </summary>
public static class PlannedMealCounter
{
    /// <summary>
    /// Gets the number of planned meals for a specific date based on the plan's
    /// <see cref="NutritionPlan.StartDate"/> and the set of currently Published weeks.
    /// A date that falls in a non-published week (or before the plan started) counts
    /// as zero planned meals.
    /// </summary>
    public static int GetPlannedMealCountForDate(NutritionPlan plan, DateTime date)
    {
        if (!plan.StartDate.HasValue)
            return 0;

        var startDate = plan.StartDate.Value.Date;
        var target = date.Date;

        if (target < startDate)
            return 0;

        var daysSinceStart = (int)(target - startDate).TotalDays;
        var weekNumber = daysSinceStart / 7 + 1;
        // PlanDay.DayOfWeek is 1=Monday … 7=Sunday to match ISO week days.
        var dayOfWeek = daysSinceStart % 7 + 1;

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == weekNumber);
        if (week is null || week.Status != WeekStatus.Published)
            return 0;

        var day = week.Days.FirstOrDefault(d => d.DayOfWeek == dayOfWeek);
        return day?.Meals.Count ?? 0;
    }
}
