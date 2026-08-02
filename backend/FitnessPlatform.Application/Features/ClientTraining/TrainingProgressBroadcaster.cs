using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining;

/// <summary>
/// Shared helper that builds and broadcasts the <c>trainingprogressupdated</c>
/// SignalR event to the trainer who owns the completing client.
/// Called by all five Mark*Complete / Mark*Incomplete endpoints after a successful Mongo write.
///
/// Design notes:
/// - The trainer's UserId is read from <see cref="TrainingPlan.TrainerId"/>, which is set when
///   the plan is created and always equals the trainer's <c>ApplicationUser.Id</c>.
/// - If no trainer is linked (TrainerId is empty) the broadcast is silently skipped.
/// - Any exception from the notifier is caught and logged so the primary mutation always
///   succeeds even if the SignalR channel is unavailable.
/// </summary>
internal static class TrainingProgressBroadcaster
{
    internal const string EventName = "trainingprogressupdated";

    /// <summary>
    /// Broadcasts <c>trainingprogressupdated</c> to the trainer after a single-session mutation.
    /// </summary>
    /// <param name="notifier">Realtime notifier.</param>
    /// <param name="compliance">Compliance service for computing today's compliance and streak.</param>
    /// <param name="mongo">Mongo context for counting today's session completions.</param>
    /// <param name="plan">The client's active training plan.</param>
    /// <param name="clientId">The client's public Guid (MongoDB clientId).</param>
    /// <param name="sessionId">The session that was mutated.</param>
    /// <param name="date">The date for which the mutation occurred.</param>
    /// <param name="completedExerciseCount">Completed exercises in the session after mutation.</param>
    /// <param name="totalExerciseCount">Total exercises in the session.</param>
    /// <param name="logger">Logger for swallowing broadcast errors.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <param name="sectionId">
    /// When the mutation originated from a <c>MarkWorkoutComplete</c> /
    /// <c>MarkWorkoutIncomplete</c> call, the specific section that was mutated.
    /// Null for exercise-level or whole-session mutations.
    /// </param>
    /// <param name="sectionComplete">
    /// Whether the section identified by <paramref name="sectionId"/> is now fully complete.
    /// Meaningful only when <paramref name="sectionId"/> is non-null.
    /// </param>
    internal static async Task BroadcastSessionAsync(
        IRealtimeNotifier notifier,
        IComplianceService compliance,
        IMongoContext mongo,
        TrainingPlan plan,
        Guid clientId,
        Guid sessionId,
        DateOnly date,
        int completedExerciseCount,
        int totalExerciseCount,
        ILogger logger,
        CancellationToken ct,
        Guid? sectionId = null,
        bool sectionComplete = false)
    {
        var trainerId = plan.TrainerId;
        if (trainerId == Guid.Empty)
            return;

        try
        {
            var (compliancePercent, streak, sessionsCompleted, sessionsPlanned) =
                await ComputeMetricsAsync(compliance, mongo, plan, clientId, date, ct);

            var payload = new TrainingProgressUpdatedEvent
            {
                ClientId = clientId,
                SessionId = sessionId,
                Date = date,
                CompletedExerciseCount = completedExerciseCount,
                TotalExerciseCount = totalExerciseCount,
                SessionComplete = completedExerciseCount >= totalExerciseCount,
                SectionId = sectionId,
                SectionComplete = sectionId.HasValue && sectionComplete,
                NewCompliancePercent = compliancePercent,
                NewStreak = streak,
                SessionsCompletedToday = sessionsCompleted,
                SessionsPlannedToday = sessionsPlanned
            };

            await notifier.NotifyAsync(trainerId, EventName, payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to broadcast {Event} for client {ClientId} to trainer {TrainerId}. The mutation succeeded.",
                EventName, clientId, trainerId);
        }
    }

    /// <summary>
    /// Broadcasts <c>trainingprogressupdated</c> to the trainer after a whole-day mutation
    /// that may have touched multiple sessions.
    /// </summary>
    /// <param name="notifier">Realtime notifier.</param>
    /// <param name="compliance">Compliance service for computing today's compliance and streak.</param>
    /// <param name="mongo">Mongo context for counting today's session completions.</param>
    /// <param name="plan">The client's active training plan.</param>
    /// <param name="clientId">The client's public Guid (MongoDB clientId).</param>
    /// <param name="date">The date for which the mutation occurred.</param>
    /// <param name="aggregateCompletedExercises">Sum of completed exercises across all updated sessions.</param>
    /// <param name="aggregateTotalExercises">Sum of total exercises across all updated sessions.</param>
    /// <param name="logger">Logger for swallowing broadcast errors.</param>
    /// <param name="ct">Cancellation token.</param>
    internal static async Task BroadcastWholeDayAsync(
        IRealtimeNotifier notifier,
        IComplianceService compliance,
        IMongoContext mongo,
        TrainingPlan plan,
        Guid clientId,
        DateOnly date,
        int aggregateCompletedExercises,
        int aggregateTotalExercises,
        ILogger logger,
        CancellationToken ct)
    {
        var trainerId = plan.TrainerId;
        if (trainerId == Guid.Empty)
            return;

        try
        {
            var (compliancePercent, streak, sessionsCompleted, sessionsPlanned) =
                await ComputeMetricsAsync(compliance, mongo, plan, clientId, date, ct);

            var payload = new TrainingProgressUpdatedEvent
            {
                ClientId = clientId,
                SessionId = null,
                Date = date,
                CompletedExerciseCount = aggregateCompletedExercises,
                TotalExerciseCount = aggregateTotalExercises,
                SessionComplete = aggregateTotalExercises > 0 && aggregateCompletedExercises >= aggregateTotalExercises,
                NewCompliancePercent = compliancePercent,
                NewStreak = streak,
                SessionsCompletedToday = sessionsCompleted,
                SessionsPlannedToday = sessionsPlanned
            };

            await notifier.NotifyAsync(trainerId, EventName, payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to broadcast {Event} (whole-day) for client {ClientId} to trainer {TrainerId}. The mutation succeeded.",
                EventName, clientId, trainerId);
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /// <summary>
    /// Computes today's compliance, streak, and session counts in parallel.
    /// </summary>
    private static async Task<(decimal CompliancePercent, int Streak, int SessionsCompleted, int SessionsPlanned)>
        ComputeMetricsAsync(
            IComplianceService compliance,
            IMongoContext mongo,
            TrainingPlan plan,
            Guid clientId,
            DateOnly date,
            CancellationToken ct)
    {
        var todayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var todayEnd = todayStart.AddDays(1);

        // Run compliance + streak concurrently
        var complianceTask = compliance.CalculateComplianceAsync(clientId, todayStart, todayStart, ct);
        var streakTask = compliance.CalculateStreakAsync(clientId, ct);

        await Task.WhenAll(complianceTask, streakTask);

        var complianceResult = await complianceTask;
        var streak = await streakTask;

        // Count sessions planned and completed today from the plan
        var sessionsPlanned = GetPlannedSessionsForDate(plan, date);
        var sessionsCompleted = await CountCompletedSessionsAsync(mongo, clientId, plan, date, sessionsPlanned, ct);

        return (complianceResult.CompliancePercent, streak, sessionsCompleted, sessionsPlanned.Count);
    }

    /// <summary>
    /// Returns the sessions scheduled for a specific date based on the plan's published weeks.
    /// Delegates to the same logic used in the MarkWholeDayCompleteEndpoint.
    /// </summary>
    private static IReadOnlyList<TrainingSession> GetPlannedSessionsForDate(TrainingPlan plan, DateOnly date)
    {
        if (!plan.StartDate.HasValue || plan.Weeks.Count == 0)
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
            date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));

        if (resolved is null)
            return [];

        // Past the last published week → no sessions for this date.
        // See GetTodaySessionEndpoint for the full rationale.
        if (resolved.Value > publishedWeeks[^1].WeekNumber)
            return [];

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == resolved.Value);
        if (week is null || week.Status != WeekStatus.Published)
        {
            week = publishedWeeks.LastOrDefault(w => w.WeekNumber <= resolved.Value);
            if (week is null) return [];
        }

        var dow = (int)date.DayOfWeek;
        dow = dow == 0 ? 7 : dow;

        return week.Sessions.Where(s => s.DayOfWeek == dow).OrderBy(s => s.Order).ToList();
    }

    /// <summary>
    /// Counts how many of today's planned sessions are fully complete.
    /// A session is "complete" when its completion document contains all exercise IDs.
    /// </summary>
    private static async Task<int> CountCompletedSessionsAsync(
        IMongoContext mongo,
        Guid clientId,
        TrainingPlan plan,
        DateOnly date,
        IReadOnlyList<TrainingSession> plannedSessions,
        CancellationToken ct)
    {
        if (plannedSessions.Count == 0)
            return 0;

        var targetDate = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var sessionIds = plannedSessions.Select(s => s.SessionId).ToList();

        var filter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, clientId)
                     & Builders<SessionExecution>.Filter.Eq(c => c.Date, targetDate)
                     & Builders<SessionExecution>.Filter.In(c => c.SessionId, sessionIds.Cast<Guid?>());

        using var cursor = await mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
        var executions = await cursor.ToListAsync(ct);

        var executionMap = executions.ToDictionary(c => c.SessionId!.Value);

        var count = 0;
        foreach (var session in plannedSessions)
        {
            if (session.Exercises.Count == 0)
                continue;

            // Uses the shared section-aware SessionExecutionExtensions.IsSessionComplete
            // helper (consults CompletedExerciseIdsBySection, not the retired flat mirror)
            // so a duplicate exercise id spanning two sections can't false-positive.
            if (executionMap.TryGetValue(session.SessionId, out var execution)
                && execution.IsSessionComplete(session))
                count++;
        }

        return count;
    }
}
