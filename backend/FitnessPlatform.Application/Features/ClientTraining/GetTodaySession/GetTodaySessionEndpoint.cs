using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;

/// <summary>
/// Returns today's planned training session based on the client's active training plan.
/// Enriches each session in the response with its current lock state (Stable/Editing/Live)
/// and lock holder (Coach/Client/null) via a single batch <c>GetStateAsync</c> call.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="lockService">Session lock service — used to batch-fetch lock state.</param>
public class GetTodaySessionEndpoint(IMongoContext mongo, IApplicationDbContext db, ISessionLockService lockService) : EndpointWithoutRequest<GetTodaySessionResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/training/plan/today");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get today's training session";
            s.Description = "Returns the training session planned for today based on the active plan and week cycle.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientId = clientProfile.PublicId;
        // WorkoutLog.ClientId is stored as the auth user's Id (ApplicationUser.Id),
        // not the ClientProfile.PublicId. Keep a separate variable so the two
        // collections can be queried with the correct identifier.
        var userIdGuid = Guid.Parse(userId);

        // Find the active training plan for this client
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.OkAsync(new GetTodaySessionResponse { HasSession = false }, ct);
            return;
        }

        // Base response: always expose plan metadata once an Active plan exists so the client
        // can preview it on the Plans screen even when there's no session for today (e.g. plan
        // not started yet, no published weeks, or today is a rest day).
        var response = new GetTodaySessionResponse
        {
            HasSession = false,
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            TotalWeeks = plan.Weeks.Count,
            Status = plan.Status.ToString(),
            QuestionnaireResponseId = plan.QuestionnaireResponseId,
            DateCompleted = plan.DateCompleted
        };

        if (plan.Weeks.Count == 0)
        {
            await Send.OkAsync(response, ct);
            return;
        }

        // Calculate current week based on plan publish date and cycling
        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
        {
            await Send.OkAsync(response, ct);
            return;
        }

        // Calculate current week using StartDate if available, otherwise fall back to DatePublished
        var resolvedWeek = PlanWeekCalculator.ResolveCurrentWeekNumber(
            plan.StartDate,
            publishedWeeks.Select(w => w.WeekNumber).ToList(),
            plan.Weeks.Count,
            publishedWeeks.First().DatePublished,
            plan.DateCreated,
            DateTime.UtcNow);

        if (resolvedWeek is null)
        {
            // Plan hasn't started yet — still surface plan metadata so the client can preview it.
            await Send.OkAsync(response, ct);
            return;
        }

        int currentWeekNumber = resolvedWeek.Value;

        // Past the last published week → the trainer hasn't queued anything
        // for today. Don't clamp to `publishedWeeks.Last()`: clamping would
        // keep the last published week's day-of-week sessions visible
        // indefinitely after the published portion ends (e.g. yesterday was
        // the last day of the last published week → today must show nothing).
        if (currentWeekNumber > publishedWeeks[^1].WeekNumber)
        {
            await Send.OkAsync(response, ct);
            return;
        }

        var currentWeek = plan.Weeks.FirstOrDefault(w => w.WeekNumber == currentWeekNumber);
        if (currentWeek is null || currentWeek.Status != WeekStatus.Published)
        {
            // Gap-skip: the calculated week isn't published but earlier
            // weeks are (e.g. trainer published 1, 2, 4 and today resolves
            // to week 3). Fall back to the latest published week that's
            // not after the calculated one — this preserves the "ahead of
            // trainer is hidden, behind catches up" intent.
            currentWeek = publishedWeeks.LastOrDefault(w => w.WeekNumber <= currentWeekNumber);
            if (currentWeek is null)
            {
                await Send.OkAsync(response, ct);
                return;
            }
        }

        // Find today's sessions (1 = Monday, 7 = Sunday)
        var todayDow = (int)DateTime.UtcNow.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow; // Convert Sunday from 0 to 7

        var todaySessions = currentWeek.Sessions
            .Where(s => s.DayOfWeek == todayDow)
            .OrderBy(s => s.Order)
            .ToList();

#pragma warning disable CS0618 // Session is intentionally set for backwards compatibility
        response.Sessions = todaySessions;
        response.Session = todaySessions.Count > 0 ? todaySessions[0] : null;
        response.HasSession = todaySessions.Count > 0;
#pragma warning restore CS0618
        response.CurrentWeek = currentWeek.WeekNumber;

        // ── Batch-fetch Exercise docs for muscle-group enrichment ─────────────
        var exerciseIds = todaySessions
            .SelectMany(s => s.Exercises)
            .Select(e => e.ExerciseExternalId)
            .Distinct()
            .ToList();

        if (exerciseIds.Count > 0)
        {
            var exerciseFilter = Builders<Exercise>.Filter.In(e => e.ExternalId, exerciseIds);
            using var exerciseCursor = await mongo.Exercises.FindAsync(
                exerciseFilter,
                cancellationToken: ct);
            var exerciseDocs = await exerciseCursor.ToListAsync(ct);

            foreach (var ex in exerciseDocs)
                response.ExerciseMuscleGroups[ex.ExternalId] = ex.MuscleGroups;
        }

        // ── Batch-fetch TrainingCompletion + WorkoutLog docs for today ────────
        // Both collections are sources of truth for "was exercise X completed today":
        //   - TrainingCompletion — lightweight Today-card checkbox toggles.
        //   - WorkoutLog         — the live training assistant's per-set logs.
        // We merge them so the home card reflects progress made via either surface.
        if (todaySessions.Count > 0)
        {
            var targetDate = DateTime.UtcNow.Date;
            var tomorrow = targetDate.AddDays(1);
            var todaySessionIds = todaySessions.Select(s => s.SessionId).ToList();

            // Per-session accumulator so entries from both collections union cleanly.
            var completedBySession = new Dictionary<Guid, HashSet<Guid>>();

            // 1. TrainingCompletion — one doc per (clientId, date, sessionId).
            var completionFilter =
                Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                & Builders<TrainingCompletion>.Filter.In(c => c.SessionId, todaySessionIds);

            using var completionCursor = await mongo.TrainingCompletions.FindAsync(
                completionFilter,
                cancellationToken: ct);
            var completionDocs = await completionCursor.ToListAsync(ct);

            // Build a lookup for sessions by sessionId so backfill can resolve section membership.
            var sessionLookup = todaySessions.ToDictionary(s => s.SessionId);

            foreach (var doc in completionDocs)
            {
                if (!completedBySession.TryGetValue(doc.SessionId, out var set))
                    completedBySession[doc.SessionId] = set = [];
                foreach (var exId in doc.CompletedExerciseIds)
                    set.Add(exId);

                response.VersionBySession[doc.SessionId] = doc.Version;
                response.CompletedSectionIdsBySession[doc.SessionId] =
                    (doc.CompletedSectionIds ?? new List<Guid>()).ToList();

                // Populate section-aware field using read-time backfill.
                if (sessionLookup.TryGetValue(doc.SessionId, out var completionSession))
                {
                    var effective = TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(
                        doc, completionSession);
                    response.CompletedExerciseIdsBySectionAndSession[doc.SessionId] =
                        effective.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.ToList());
                }
            }

            // 2. WorkoutLog — live-training logs for today. An exercise counts as
            // completed when every planned set has a CompletedAt timestamp.
            // IMPORTANT: WorkoutLog.ClientId is written as the auth user's Id (Guid),
            // NOT clientProfile.PublicId. Use userIdGuid here — using clientId silently
            // returns nothing because the two identifiers never match.
            var logFilter =
                Builders<WorkoutLog>.Filter.Eq(l => l.ClientId, userIdGuid)
                & Builders<WorkoutLog>.Filter.In(l => l.SessionId, todaySessionIds.Cast<Guid?>())
                & Builders<WorkoutLog>.Filter.Gte(l => l.StartedAt, targetDate)
                & Builders<WorkoutLog>.Filter.Lt(l => l.StartedAt, tomorrow);

            var workoutLogs = await mongo.WorkoutLogs
                .Find(logFilter)
                .ToListAsync(ct);

            // Use only the LATEST log per session (by StartedAt descending).
            // When the user restarts a session mid-day, the earlier completed log
            // must not union its fully-done exercises on top of the fresh partial
            // log — that would falsely mark the whole session as finished on the
            // Today card even though the current attempt is only partially done.
            var latestLogPerSession = workoutLogs
                .Where(l => l.SessionId is not null)
                .GroupBy(l => l.SessionId!.Value)
                .Select(g => g.OrderByDescending(l => l.StartedAt)
                              .ThenByDescending(l => l.DateCreated) // stable tie-breaker: newest insert wins when StartedAt is identical
                              .First());

            foreach (var log in latestLogPerSession)
            {
                if (!completedBySession.TryGetValue(log.SessionId!.Value, out var set))
                    completedBySession[log.SessionId.Value] = set = [];

                var setsForExerciseInSession = new Dictionary<Guid, List<int>>();
                foreach (var ex in log.Exercises)
                {
                    if (ex.Sets.Count == 0) continue;
                    if (ex.Sets.All(s => s.CompletedAt is not null))
                        set.Add(ex.ExerciseExternalId);

                    var completedSetNumbers = ex.Sets
                        .Where(s => s.CompletedAt is not null)
                        .Select(s => s.SetNumber)
                        .ToList();
                    if (completedSetNumbers.Count > 0)
                        setsForExerciseInSession[ex.ExerciseExternalId] = completedSetNumbers;
                }
                if (setsForExerciseInSession.Count > 0)
                    response.CompletedSetsBySessionExercise[log.SessionId.Value] = setsForExerciseInSession;
            }

            foreach (var (sessionId, set) in completedBySession)
                response.CompletedExerciseIdsBySession[sessionId] = set.ToList();

            // ── Batch-fetch lock state for today's sessions ───────────────────────
            // Single Mongo round-trip for all sessions (not one per session).
            var lockDocs = await lockService.GetStateAsync(todaySessionIds, ct);
            var lockLookup = lockDocs.ToDictionary(l => l.SessionId);

            foreach (var sessionId in todaySessionIds)
            {
                if (lockLookup.TryGetValue(sessionId, out var lockDoc))
                {
                    response.LockStateBySession[sessionId] = lockDoc.Type.ToString();
                    response.LockHolderBySession[sessionId] = lockDoc.Holder.ToString();
                }
                // Missing entry = Stable (no active lock). No entry added to the dicts.
            }

            // ── Derive per-set completion from exercise-level completion ──────────
            // When an exercise is marked complete via the Today-card checkbox
            // (TrainingCompletion) rather than the live training assistant
            // (WorkoutLog), the WorkoutLog-merge pass above never stamps individual
            // sets.  As a result CompletedSetsBySessionExercise stays empty for
            // those exercises even though the exercise/session checkbox is filled —
            // a visible inconsistency on the per-set ✓ column.
            //
            // Rule: for any exercise already present in CompletedExerciseIdsBySession
            // (sourced from either TrainingCompletion OR a fully-completed WorkoutLog),
            // ensure every planned set number for that exercise appears in the map.
            // We union with any existing list so partial-log progress is preserved
            // when the checkbox is also ticked.
            //
            // Run AFTER the WorkoutLog merge so latest-log-wins logic is undisturbed.
            foreach (var session in todaySessions)
            {
                if (!response.CompletedExerciseIdsBySession.TryGetValue(session.SessionId, out var completedExIds))
                    continue;

                if (!response.CompletedSetsBySessionExercise.TryGetValue(session.SessionId, out var sessionSetsMap))
                    response.CompletedSetsBySessionExercise[session.SessionId] = sessionSetsMap = new Dictionary<Guid, List<int>>();

                foreach (var plannedEx in session.Exercises)
                {
                    if (!completedExIds.Contains(plannedEx.ExerciseExternalId))
                        continue;

                    var plannedSetNumbers = plannedEx.Sets.Select(s => s.SetNumber).ToList();
                    if (plannedSetNumbers.Count == 0)
                        continue;

                    if (sessionSetsMap.TryGetValue(plannedEx.ExerciseExternalId, out var existing))
                        sessionSetsMap[plannedEx.ExerciseExternalId] =
                            existing.Union(plannedSetNumbers).OrderBy(n => n).ToList();
                    else
                        sessionSetsMap[plannedEx.ExerciseExternalId] = plannedSetNumbers.OrderBy(n => n).ToList();
                }
            }
        }

        await Send.OkAsync(response, ct);
    }
}
