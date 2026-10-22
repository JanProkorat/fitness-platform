using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientTraining;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Lists the training sessions a training plan schedules for a calendar date.
/// </summary>
public static class PlannedSessionCounter
{
    /// <summary>
    /// Returns the training sessions scheduled for a specific calendar date,
    /// based on the plan's week cycle and published weeks.
    /// Returns an empty list for rest days, unpublished weeks, or before plan start.
    /// </summary>
    public static IReadOnlyList<TrainingSession> GetPlannedSessionsForDate(TrainingPlan plan, DateTime date)
    {
        if (!plan.StartDate.HasValue)
            return [];

        var target = date.Date;
        var startDate = plan.StartDate.Value.Date;

        if (target < startDate)
            return [];

        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
            return [];

        var resolved = PlanWeekCalculator.ResolveCurrentWeekNumber(
            plan.StartDate,
            publishedWeeks.Select(w => w.WeekNumber).ToList(),
            plan.Weeks.Count,
            publishedWeeks.First().DatePublished,
            plan.DateCreated,
            target);

        if (resolved is null)
            return [];

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == resolved.Value);
        if (week is null || week.Status != WeekStatus.Published)
            return [];

        // ISO day-of-week: 1=Monday … 7=Sunday
        var dow = (int)target.DayOfWeek;
        dow = dow == 0 ? 7 : dow;

        var day = week.Days.FirstOrDefault(d => d.DayOfWeek == dow);
        return day?.Sessions ?? [];
    }
}
