using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Features.Trainers.GetClientDashboard;

/// <summary>
/// Pure helper behind the dashboard's "sessions done this week" figures. Both numbers come from
/// the same effective week, so completed is always at most planned.
/// </summary>
internal static class WeeklySessionCompletion
{
    /// <summary>
    /// The plan week a client is in today: its calendar window and the sessions scheduled in it.
    /// </summary>
    /// <param name="Plan">The plan the week belongs to.</param>
    /// <param name="WeekStartUtc">First day of the week, as a UTC-midnight storage value (inclusive).</param>
    /// <param name="WeekEndUtc">First day after the week, as a UTC-midnight storage value (exclusive).</param>
    /// <param name="PlannedSessions">Distinct sessions scheduled in the effective week.</param>
    internal sealed record WeekScope(
        TrainingPlan Plan,
        DateTime WeekStartUtc,
        DateTime WeekEndUtc,
        IReadOnlyList<TrainingSession> PlannedSessions);

    /// <summary>
    /// Resolves the current week of the plan whose window contains the client's local today.
    /// Returns null when no plan is current, the week has no published sessions to show, or the
    /// current week is past the last published one.
    /// </summary>
    /// <param name="activePlans">The caller's Active training plans for the client.</param>
    /// <param name="instantUtc">The instant to resolve "today" from.</param>
    /// <param name="clientTimeZone">The client's time zone; the week follows their local date.</param>
    internal static WeekScope? ResolveWeek(
        IReadOnlyList<TrainingPlan> activePlans,
        DateTime instantUtc,
        TimeZoneInfo clientTimeZone)
    {
        var localToday = ClientLocalDateResolver.ResolveLocalDate(instantUtc, clientTimeZone);

        var plan = PlanWindowResolver.ResolveCurrentPlanStrict(
            activePlans, p => p.StartDate, p => p.Weeks.Count, localToday);

        if (plan is null)
        {
            return null;
        }

        var planStart = DateOnly.FromDateTime(plan.StartDate!.Value);
        var weekNumber = ((localToday.DayNumber - planStart.DayNumber) / 7) + 1;

        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0 || weekNumber > publishedWeeks[^1].WeekNumber)
        {
            return null;
        }

        // An unpublished current week falls back to the latest published one before it.
        var effectiveWeek = publishedWeeks.LastOrDefault(w => w.WeekNumber <= weekNumber);

        if (effectiveWeek is null)
        {
            return null;
        }

        var plannedSessions = effectiveWeek.Days
            .SelectMany(d => d.Sessions)
            .DistinctBy(s => s.SessionId)
            .ToList();

        var weekStart = planStart.AddDays(7 * (weekNumber - 1));

        return new WeekScope(
            plan,
            weekStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            weekStart.AddDays(7).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            plannedSessions);
    }

    /// <summary>
    /// Counts the planned sessions with at least one complete execution inside the week. Each
    /// session counts once however many days it was executed on.
    /// </summary>
    /// <param name="week">The resolved week.</param>
    /// <param name="executions">Candidate executions; ones outside the plan, week or schedule are ignored.</param>
    internal static int CountCompleted(WeekScope week, IEnumerable<SessionExecution> executions)
    {
        var sessionsById = week.PlannedSessions.ToDictionary(s => s.SessionId);

        return executions
            .Where(e => e.PlanId == week.Plan.ExternalId
                        && e.Date >= week.WeekStartUtc
                        && e.Date < week.WeekEndUtc
                        && e.SessionId is { } sessionId
                        && sessionsById.ContainsKey(sessionId))
            .Where(e => e.IsSessionComplete(sessionsById[e.SessionId!.Value]))
            .Select(e => e.SessionId!.Value)
            .Distinct()
            .Count();
    }
}
