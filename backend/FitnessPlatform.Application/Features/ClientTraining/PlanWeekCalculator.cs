namespace FitnessPlatform.Application.Features.ClientTraining;

/// <summary>
/// Shared helper for resolving the current week number of a plan based on its start date
/// or the first published week's publish date.
/// </summary>
internal static class PlanWeekCalculator
{
    /// <summary>
    /// Resolves the current week number for a plan.
    /// </summary>
    /// <param name="startDate">
    /// The plan's explicit start date (Monday of Week 1), if set.
    /// </param>
    /// <param name="publishedWeekNumbers">
    /// Ordered list of published week numbers (ascending). Must be non-empty.
    /// </param>
    /// <param name="totalWeeks">
    /// Total number of weeks in the plan (for clamping).
    /// </param>
    /// <param name="firstPublishedDate">
    /// The <c>DatePublished</c> of the first published week, used when <paramref name="startDate"/>
    /// is null (legacy fallback).
    /// </param>
    /// <param name="planDateCreated">
    /// The plan's creation date, used as an ultimate fallback when
    /// <paramref name="firstPublishedDate"/> is also null.
    /// </param>
    /// <param name="now">The current UTC date-time (injected for testability).</param>
    /// <returns>
    /// The resolved 1-based week number, or <c>null</c> if the plan hasn't started yet
    /// (i.e. <paramref name="startDate"/> is in the future) or there are no published weeks.
    /// </returns>
    internal static int? ResolveCurrentWeekNumber(
        DateTime? startDate,
        IReadOnlyList<int> publishedWeekNumbers,
        int totalWeeks,
        DateTime? firstPublishedDate,
        DateTime planDateCreated,
        DateTime now)
    {
        if (publishedWeekNumbers.Count == 0)
            return null;

        int weekNumber;

        if (startDate.HasValue)
        {
            var daysSinceStart = (int)(now.Date - startDate.Value.Date).TotalDays;
            if (daysSinceStart < 0)
                return null; // plan hasn't started yet

            weekNumber = (daysSinceStart / 7) + 1;
            // Clamp to [1, totalWeeks]
            weekNumber = Math.Max(1, Math.Min(weekNumber, totalWeeks));
        }
        else
        {
            // Legacy fallback: cycle through published weeks based on first publish date
            var anchor = firstPublishedDate ?? planDateCreated;
            var daysSinceStart = (int)(now.Date - anchor.Date).TotalDays;
            var currentWeekIndex = (daysSinceStart / 7) % publishedWeekNumbers.Count;
            weekNumber = publishedWeekNumbers[Math.Max(0, currentWeekIndex)];
        }

        return weekNumber;
    }
}
