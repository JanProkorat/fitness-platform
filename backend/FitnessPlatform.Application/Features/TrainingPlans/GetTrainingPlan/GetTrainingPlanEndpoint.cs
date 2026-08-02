using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

/// <summary>
/// Retrieves a single training plan with full detail (weeks, sessions, exercises, sets).
/// Also returns per-session WorkoutLog execution data so the web layer can render
/// completed / skipped / not-yet-reached indicators on each set.
/// Also enriches each session with its current edit-lock state (Stable/Editing/Live) and
/// holder (Coach/Client/null) via a single batch <c>GetStateAsync</c> call on the lock service.
/// This gives the trainer plan editor the initial lock state on page load, so the Live
/// in-progress badge and unlock affordance are correct before any SignalR events arrive.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="lockService">Session lock service — used to batch-fetch lock state.</param>
/// <param name="db">PostgreSQL context — resolves the client's PublicId for the response.</param>
public class GetTrainingPlanEndpoint(IMongoContext mongo, ISessionLockService lockService, IApplicationDbContext db)
    : Endpoint<GetTrainingPlanRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/plans/{PlanId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get a training plan";
            s.Description = "Returns the full training plan with all weeks, sessions, exercises, sets, " +
                             "and per-session workout-log execution data (completed/skipped set indicators).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        // Ownership gate: treat "not mine" as "not found" to avoid existence leak.
        if (plan is null || plan.TrainerId != trainerId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // plan.ClientId is the internal ApplicationUser.Id storage key (#840); the response's
        // ClientId must stay the client-facing ClientProfile.PublicId (pre-#840 contract) since
        // web/mobile feed it into /trainer/clients/{clientId}/... routes.
        var clientPublicId = await db.ResolveClientPublicIdAsync(plan.ClientId, ct);
        var response = GetTrainingPlanResponse.FromDocument(plan, clientPublicId);

        // ── 1. SessionExecution fold-in (#841: unifies the former TrainingCompletion +
        // WorkoutLog fold-ins into a single query — same client-wide scope the old
        // TrainingCompletion query used, not PlanId-scoped, so this preserves the exact
        // (slightly broader than PlanId) query shape the response has always had). ─────
        var executionFilter = Builders<SessionExecution>.Filter.Eq(c => c.ClientId, plan.ClientId);
        var executionSort = Builders<SessionExecution>.Sort
            .Ascending(c => c.Date)
            .Ascending(c => c.SessionId);
        var executionCursor = await mongo.SessionExecutions.FindAsync(
            executionFilter,
            new FindOptions<SessionExecution> { Sort = executionSort },
            ct);
        var executions = await executionCursor.ToListAsync(ct);

        // Build a session lookup for read-time backfill of legacy completions.
        // Keys are SessionId; sessions are already backfilled by FromDocument().
        var sessionLookup = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .ToDictionary(s => s.SessionId);

        // #857 phase 3b: SessionExecution.CompletedExerciseInstanceIds is a flat list of
        // SessionExercise.ExerciseId instance values. Reconstruct the wire-compatible
        // (ExerciseExternalId-keyed) shape by mapping each completed instance back to its
        // catalog external id and containing workout via the session definition — preserves
        // the exact pre-#857-phase-3b response contract with no client-visible change.
        response.Completions = executions
            .Where(e => e.SessionId.HasValue)
            .Select(c =>
            {
                sessionLookup.TryGetValue(c.SessionId!.Value, out var session);

                var completedExternalIds = new List<Guid>();
                var bySection = new Dictionary<Guid, List<Guid>>();

                if (session is not null)
                {
                    foreach (var workout in session.Workouts)
                    {
                        var completedInWorkout = workout.Exercises
                            .Where(e => c.CompletedExerciseInstanceIds.Contains(e.ExerciseId))
                            .Select(e => e.ExerciseExternalId)
                            .ToList();

                        if (completedInWorkout.Count > 0)
                        {
                            bySection[workout.WorkoutId] = completedInWorkout;
                            completedExternalIds.AddRange(completedInWorkout);
                        }
                    }

                    completedExternalIds.AddRange(session.StandaloneExercises
                        .Where(e => c.CompletedExerciseInstanceIds.Contains(e.ExerciseId))
                        .Select(e => e.ExerciseExternalId));
                }

                return new TrainingPlanCompletionDto
                {
                    Date = DateOnly.FromDateTime(c.Date),
                    SessionId = c.SessionId!.Value,
                    CompletedExerciseIds = completedExternalIds.Distinct().ToList(),
                    CompletedExerciseIdsBySection = bySection,
                    CompletedSectionIds = c.CompletedWorkoutIds ?? [],
                    Version = c.Version
                };
            })
            .ToList();

        // ── 2. Performance fold-in — builds SessionExecutionDto entries ──────────
        // Only executions that carry Performance data (a live-training-assistant log) — a
        // checkbox-only execution has nothing to build set-level DTOs from.
        var executionsWithPerformance = executions.Where(e => e.Performance is not null).ToList();

        if (executionsWithPerformance.Count > 0)
        {
            // Deduplicate per sessionId:
            //   - Prefer the most-recently-updated FINALISED execution (Status == Completed).
            //   - Fall back to the most recent in-progress execution.
            //   This mirrors the precedence rule in the client GetFullPlan endpoint.
            var bestLogBySession = executionsWithPerformance
                .Where(l => l.SessionId.HasValue)
                .GroupBy(l => l.SessionId!.Value)
                .Select(g =>
                {
                    var finalised = g
                        .Where(l => l.Status == SessionExecutionStatus.Completed)
                        .OrderByDescending(l => l.DateUpdated ?? l.DateCreated)
                        .FirstOrDefault();

                    return finalised ?? g
                        .OrderByDescending(l => l.DateUpdated ?? l.DateCreated)
                        .First();
                })
                .ToList();

            response.SessionExecutions = bestLogBySession
                .Select(log =>
                {
                    // Build the per-exercise maps of completed set numbers and logged set data.
                    // A set is "completed" iff its WorkoutSet.CompletedAt is non-null.
                    //
                    // We populate both the legacy flat maps (keyed by ExerciseExternalId alone)
                    // and the new section-aware maps (keyed by "{sectionId}:{exerciseId}").
                    // The flat maps are kept for backward compatibility but are unreliable when
                    // the same exercise appears in two sections — in that case the last-encountered
                    // section wins in the flat map. The section-aware maps are authoritative.
                    var completedSetsByExercise = new Dictionary<Guid, List<int>>();
                    var completedSetsBySectionAndExercise = new Dictionary<string, List<int>>();
                    var loggedSetsByExercise = new Dictionary<Guid, List<LoggedSetDto>>();
                    var loggedSetsBySectionAndExercise = new Dictionary<string, List<LoggedSetDto>>();
                    var sessionHasModifications = false;

                    foreach (var workout in log.Performance!.Workouts)
                    {
                        foreach (var ex in workout.Exercises)
                        {
                            var sectionKey = $"{workout.WorkoutId}:{ex.ExerciseExternalId}";

                            var completedSetNumbers = ex.Sets
                                .Where(s => s.CompletedAt.HasValue)
                                .Select(s => s.SetNumber)
                                .OrderBy(n => n)
                                .ToList();

                            if (completedSetNumbers.Count > 0)
                            {
                                // Flat map (last-write-wins for same exercise across sections).
                                completedSetsByExercise[ex.ExerciseExternalId] = completedSetNumbers;
                                // Section-aware map.
                                completedSetsBySectionAndExercise[sectionKey] = completedSetNumbers;
                            }

                            // Build value-bearing LoggedSetDto list for every set in this exercise.
                            var loggedSetDtos = ex.Sets.Select(s => new LoggedSetDto
                            {
                                SetNumber = s.SetNumber,
                                ActualReps = s.Reps,
                                ActualWeightKg = s.WeightKg,
                                ActualRpe = s.Rpe,
                                ActualDurationSeconds = s.DurationSeconds,
                                ActualDistanceMeters = s.DistanceMeters,
                                PlannedReps = s.PlannedReps,
                                PlannedWeightKg = s.PlannedWeightKg,
                                PlannedRpe = s.PlannedRpe,
                                PlannedDurationSeconds = s.PlannedDurationSeconds,
                                PlannedDistanceMeters = s.PlannedDistanceMeters,
                                IsModified = s.IsModified
                            }).ToList();

                            if (loggedSetDtos.Count > 0)
                            {
                                // Flat map (last-write-wins for same exercise across sections).
                                loggedSetsByExercise[ex.ExerciseExternalId] = loggedSetDtos;
                                // Section-aware map.
                                loggedSetsBySectionAndExercise[sectionKey] = loggedSetDtos;
                            }

                            if (loggedSetDtos.Any(s => s.IsModified))
                                sessionHasModifications = true;
                        }
                    }

                    return new SessionExecutionDto
                    {
                        SessionId = log.SessionId!.Value,
                        IsSessionFinished = log.Status == SessionExecutionStatus.Completed,
                        CompletedSetsByExercise = completedSetsByExercise,
                        CompletedSetsBySectionAndExercise = completedSetsBySectionAndExercise,
                        LoggedSetsByExercise = loggedSetsByExercise,
                        LoggedSetsBySectionAndExercise = loggedSetsBySectionAndExercise,
                        HasModifications = sessionHasModifications
                    };
                })
                .ToList();
        }

        // ── 3. Checkbox-completion-based finished state fold-in ──────────────────
        // The mobile "mark whole day complete" checkbox writes completion flags but may leave
        // Performance null. Without this step, sessions finished via that path would never
        // appear as IsSessionFinished=true on the trainer portal (fix for issue #429).
        //
        // For each session that has at least one fully-complete execution (any date), ensure a
        // SessionExecutionDto entry exists with IsSessionFinished=true. "Fully complete" is
        // IsSessionComplete() — the same logic as the MarkSessionComplete idempotency check.
        //
        // Date-scoping: we match the most-complete execution per session regardless of date,
        // mirroring the Performance dedup which also collapses across dates. The finished-state
        // is a permanent property of the session — it does not reset between scheduled
        // occurrences for the same session definition.
        var completions = executions.Where(e => e.SessionId.HasValue).ToList();

        if (completions.Count > 0)
        {
            // Find sessions whose execution is fully done (any date — finished state is permanent).
            var finishedByCompletion = completions
                .Where(c => sessionLookup.TryGetValue(c.SessionId!.Value, out var s) && c.IsSessionComplete(s))
                .Select(c => c.SessionId!.Value)
                .ToHashSet();

            if (finishedByCompletion.Count > 0)
            {
                // Index existing SessionExecutions by SessionId for O(1) lookup.
                var executionsBySession = response.SessionExecutions
                    .ToDictionary(e => e.SessionId);

                foreach (var sessionId in finishedByCompletion)
                {
                    if (executionsBySession.TryGetValue(sessionId, out var existing))
                    {
                        // Session already has a Performance-backed entry — OR-in the
                        // completion-based flag (covers the edge case where Performance isn't
                        // finalised but the home-checkbox completion says it's done).
                        if (!existing.IsSessionFinished)
                            existing.IsSessionFinished = true;
                    }
                    else
                    {
                        // No Performance entry for this session — emit a synthetic entry so the
                        // trainer portal renders the session as finished and hides the unlock affordance.
                        response.SessionExecutions.Add(new SessionExecutionDto
                        {
                            SessionId = sessionId,
                            IsSessionFinished = true,
                            CompletedSetsByExercise = new Dictionary<Guid, List<int>>()
                        });
                    }
                }
            }
        }

        // ── 3b. Per-section finished state fold-in ───────────────────────────────
        // For each session that has execution data, project per-section finished state into
        // FinishedWorkouts. This feeds the web trainer portal so it can render a "Finished"
        // label per section and gate the edit-lock unlock affordance at section granularity
        // (issue #465). IsWorkoutComplete() already folds in both signals (finished Performance,
        // checkbox completion flags) since #841 merged them onto one document.
        if (completions.Count > 0 || response.SessionExecutions.Any(e => e.IsSessionFinished))
        {
            var bestCompletionBySession = completions
                .GroupBy(c => c.SessionId!.Value)
                .ToDictionary(g => g.Key,
                    g => g.OrderByDescending(c => c.DateUpdated ?? c.DateCreated).First());

            var executionIndex = response.SessionExecutions.ToDictionary(e => e.SessionId);

            foreach (var (sessionId, session) in sessionLookup)
            {
                if (session.Workouts.Count == 0) continue;

                var hasFinishedLog = executionIndex.TryGetValue(sessionId, out var exec) && exec.IsSessionFinished;
                bestCompletionBySession.TryGetValue(sessionId, out var bestCompletion);

                // Skip this session if there is nothing to project.
                if (!hasFinishedLog && bestCompletion is null) continue;

                var finishedSections = session.Workouts
                    .Select(sec => new WorkoutFinishedStateDto
                    {
                        SectionId = sec.WorkoutId,
                        IsFinished = bestCompletion.IsWorkoutComplete(session, sec)
                    })
                    .Where(dto => dto.IsFinished)
                    .ToList();

                if (finishedSections.Count > 0)
                {
                    if (exec is not null)
                    {
                        exec.FinishedWorkouts = finishedSections;
                    }
                    else
                    {
                        // No execution entry yet (partial completion with no Performance) —
                        // add a synthetic entry so FinishedWorkouts is visible to the web layer.
                        response.SessionExecutions.Add(new SessionExecutionDto
                        {
                            SessionId = sessionId,
                            IsSessionFinished = false,
                            CompletedSetsByExercise = new Dictionary<Guid, List<int>>(),
                            FinishedWorkouts = finishedSections
                        });
                    }
                }
            }
        }

        // ── 4. Batch-fetch session lock state ────────────────────────────────────
        // Single Mongo round-trip — not one per session. Mirrors the pattern used
        // in GetFullTrainingPlanEndpoint (client read) so the shape is consistent.
        var allSessionIds = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .Select(s => s.SessionId)
            .ToList();

        if (allSessionIds.Count > 0)
        {
            var lockDocs = await lockService.GetStateAsync(allSessionIds, ct);

            response.SessionLockStates = lockDocs
                .Select(l => new SessionLockStateDto
                {
                    SessionId = l.SessionId,
                    LockState = l.Type.ToString(),
                    LockHolder = l.Holder.ToString()
                })
                .ToList();
        }

        await Send.OkAsync(response, ct);
    }
}
