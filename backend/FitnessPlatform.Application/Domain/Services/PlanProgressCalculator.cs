using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Plan date window and training-session progress shared by every endpoint that reports plan progress.
/// </summary>
public static class PlanProgressCalculator
{
    /// <summary>
    /// The plan's last day: its start date plus the planned weeks. Null when the plan has no start date.
    /// </summary>
    public static DateTime? ResolveEndDate(DateTime? startDate, int totalWeeks) =>
        startDate?.Date.AddDays(totalWeeks * 7 - 1);

    /// <summary>
    /// The days progress is counted over: from the plan's start to today, capped at the plan's last day.
    /// Null when there is no start date or the plan has not started yet.
    /// </summary>
    public static (DateTime Start, DateTime End)? ResolveProgressWindow(
        DateTime? startDate, int totalWeeks, DateTime today)
    {
        if (!startDate.HasValue)
        {
            return null;
        }

        var start = startDate.Value.Date;
        var planEnd = ResolveEndDate(startDate, totalWeeks)!.Value;
        var end = today.Date < planEnd ? today.Date : planEnd;

        return end < start ? null : (start, end);
    }

    /// <summary>
    /// Counts the sessions the plan schedules inside the window and how many of them the client completed
    /// on their scheduled day. Executions of other plans are ignored.
    /// </summary>
    public static (int Total, int Done) CountSessions(
        TrainingPlan plan,
        (DateTime Start, DateTime End) window,
        IEnumerable<SessionExecution> executions)
    {
        var executionsByKey = new Dictionary<(Guid? SessionId, DateTime Date), SessionExecution>();
        foreach (var execution in executions.Where(e => e.PlanId == plan.ExternalId))
        {
            executionsByKey.TryAdd((execution.SessionId, execution.Date.Date), execution);
        }

        var total = 0;
        var done = 0;

        for (var day = window.Start; day <= window.End; day = day.AddDays(1))
        {
            foreach (var session in PlannedSessionCounter.GetPlannedSessionsForDate(plan, day))
            {
                total++;

                // A session with nothing programmed is never complete (same guard as ComplianceService).
                var hasContent = session.Workouts.Count > 0 || session.StandaloneExercises.Count > 0;
                if (hasContent
                    && executionsByKey.TryGetValue((session.SessionId, day), out var execution)
                    && execution.IsSessionComplete(session))
                {
                    done++;
                }
            }
        }

        return (total, done);
    }
}
