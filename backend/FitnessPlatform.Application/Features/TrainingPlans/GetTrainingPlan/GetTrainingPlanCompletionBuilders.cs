using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

/// <summary>
/// Cross-store assembly for <see cref="GetTrainingPlanEndpoint"/> — extracted out of
/// <c>HandleAsync</c> into named, independently testable units (#938). Single caller; this stays a
/// same-slice sibling file (not a <c>Domain/Services/</c> promotion) because none of these four
/// concerns is shared by a second endpoint yet — see <c>rules/architecture.md#no-horizontal-layers</c>'s
/// rule-of-three.
/// </summary>
internal static class GetTrainingPlanCompletionBuilders
{
    /// <summary>
    /// Builds the per-session, per-date completion DTOs for the response's <c>Completions</c>
    /// field. #857 phase 3b / #938: the per-instance field comes from the shared canonical
    /// completion rule (<see cref="SessionExecutionExtensions.ResolveCompletedInstanceIds"/>); the
    /// catalog-external-id-keyed fields stay sourced from the raw checkbox path only, matching
    /// their pre-#938 semantics — Performance-derived completion is not reflected there.
    /// </summary>
    internal static List<TrainingPlanCompletionDto> BuildCompletions(
        List<SessionExecution> executions,
        Dictionary<Guid, TrainingSession> sessionLookup)
    {
        return executions
            .Where(e => e.SessionId.HasValue)
            .Select(c =>
            {
                sessionLookup.TryGetValue(c.SessionId!.Value, out var session);

                var completedExternalIds = new List<Guid>();
                var byWorkout = new Dictionary<Guid, List<Guid>>();

                // Canonical placement-exact completion rule (#938) — supersedes the old ad hoc
                // "carry raw ids verbatim, then fan Performance out to every sibling sharing the
                // catalog id" loop.
                var instanceIds = session is not null
                    ? c.ResolveCompletedInstanceIds(session)
                    : new HashSet<Guid>(c.CompletedExerciseInstanceIds);

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
                            byWorkout[workout.WorkoutId] = completedInWorkout;
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
                    CompletedExerciseIdsByWorkout = byWorkout,
                    CompletedExerciseInstanceIds = instanceIds.ToList(),
                    CompletedWorkoutIds = c.CompletedWorkoutIds ?? [],
                    Version = c.Version
                };
            })
            .ToList();
    }

    /// <summary>
    /// Builds the Performance-derived <see cref="SessionExecutionDto"/> entries — one per session,
    /// preferring the most-recently-updated FINALISED execution, else the most recent in-progress
    /// one (mirrors the precedence rule in the client <c>GetFullPlan</c> endpoint). Only executions
    /// that carry Performance data (a live-training-assistant log) — a checkbox-only execution has
    /// nothing to build set-level DTOs from.
    /// </summary>
    internal static List<SessionExecutionDto> BuildSessionExecutions(List<SessionExecution> executions)
    {
        var executionsWithPerformance = executions.Where(e => e.Performance is not null).ToList();

        if (executionsWithPerformance.Count == 0)
        {
            return [];
        }

        // Deduplicate per sessionId:
        //   - Prefer the most-recently-updated FINALISED execution (Status == Completed).
        //   - Fall back to the most recent in-progress execution.
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

        return bestLogBySession
            .Select(log =>
            {
                // Build the per-exercise maps of completed set numbers and logged set data.
                // A set is "completed" iff its WorkoutSet.CompletedAt is non-null.
                //
                // We populate both the legacy flat maps (keyed by ExerciseExternalId alone)
                // and the new workout-aware maps (keyed by "{workoutId}:{exerciseId}").
                // The flat maps are kept for backward compatibility but are unreliable when
                // the same exercise appears in two workouts — in that case the last-encountered
                // workout wins in the flat map. The workout-aware maps are authoritative.
                var completedSetsByExercise = new Dictionary<Guid, List<int>>();
                var completedSetsByWorkoutAndExercise = new Dictionary<string, List<int>>();
                var loggedSetsByExercise = new Dictionary<Guid, List<LoggedSetDto>>();
                var loggedSetsByWorkoutAndExercise = new Dictionary<string, List<LoggedSetDto>>();
                var sessionHasModifications = false;

                foreach (var workout in log.Performance!.Workouts)
                {
                    foreach (var ex in workout.Exercises)
                    {
                        var workoutKey = $"{workout.WorkoutId}:{ex.ExerciseExternalId}";

                        var completedSetNumbers = ex.Sets
                            .Where(s => s.CompletedAt.HasValue)
                            .Select(s => s.SetNumber)
                            .OrderBy(n => n)
                            .ToList();

                        if (completedSetNumbers.Count > 0)
                        {
                            // Flat map (last-write-wins for same exercise across workouts).
                            completedSetsByExercise[ex.ExerciseExternalId] = completedSetNumbers;
                            // Workout-aware map.
                            completedSetsByWorkoutAndExercise[workoutKey] = completedSetNumbers;
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
                            // Flat map (last-write-wins for same exercise across workouts).
                            loggedSetsByExercise[ex.ExerciseExternalId] = loggedSetDtos;
                            // Workout-aware map.
                            loggedSetsByWorkoutAndExercise[workoutKey] = loggedSetDtos;
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
                    CompletedSetsByWorkoutAndExercise = completedSetsByWorkoutAndExercise,
                    LoggedSetsByExercise = loggedSetsByExercise,
                    LoggedSetsByWorkoutAndExercise = loggedSetsByWorkoutAndExercise,
                    HasModifications = sessionHasModifications
                };
            })
            .ToList();
    }

    /// <summary>
    /// For each session with at least one fully-complete execution (any date — finished state is
    /// permanent, mirroring the Performance dedup which also collapses across dates), ensures a
    /// <see cref="SessionExecutionDto"/> entry exists with <c>IsSessionFinished = true</c>.
    /// "Fully complete" is <see cref="SessionExecutionExtensions.IsSessionComplete"/> — the same
    /// idempotency-only rule the <c>MarkSessionComplete</c> endpoint uses, deliberately unchanged
    /// by #938 (see its own remarks). Mutates <paramref name="response"/> in place.
    /// </summary>
    internal static void FoldInCheckboxFinishedState(
        GetTrainingPlanResponse response,
        List<SessionExecution> completions,
        Dictionary<Guid, TrainingSession> sessionLookup)
    {
        if (completions.Count == 0)
        {
            return;
        }

        // Find sessions whose execution is fully done (any date — finished state is permanent).
        var finishedByCompletion = completions
            .Where(c => sessionLookup.TryGetValue(c.SessionId!.Value, out var s) && c.IsSessionComplete(s))
            .Select(c => c.SessionId!.Value)
            .ToHashSet();

        if (finishedByCompletion.Count == 0)
        {
            return;
        }

        // Index existing SessionExecutions by SessionId for O(1) lookup.
        var executionsBySession = response.SessionExecutions.ToDictionary(e => e.SessionId);

        foreach (var sessionId in finishedByCompletion)
        {
            if (executionsBySession.TryGetValue(sessionId, out var existing))
            {
                // Session already has a Performance-backed entry — OR-in the completion-based
                // flag (covers the edge case where Performance isn't finalised but the
                // home-checkbox completion says it's done).
                if (!existing.IsSessionFinished)
                    existing.IsSessionFinished = true;
            }
            else
            {
                // No Performance entry for this session — emit a synthetic entry so the trainer
                // portal renders the session as finished and hides the unlock affordance.
                response.SessionExecutions.Add(new SessionExecutionDto
                {
                    SessionId = sessionId,
                    IsSessionFinished = true,
                    CompletedSetsByExercise = new Dictionary<Guid, List<int>>()
                });
            }
        }
    }

    /// <summary>
    /// Projects per-workout finished state into <c>FinishedWorkouts</c> so the web trainer portal
    /// can render a "Finished" label per workout and gate the edit-lock unlock affordance at
    /// workout granularity (issue #465). <see cref="SessionExecutionExtensions.IsWorkoutComplete"/>
    /// already folds in both signals (finished Performance, checkbox completion flags) since #841
    /// merged them onto one document — deliberately unchanged by #938. Mutates
    /// <paramref name="response"/> in place.
    /// </summary>
    internal static void FoldInWorkoutFinishedState(
        GetTrainingPlanResponse response,
        List<SessionExecution> completions,
        Dictionary<Guid, TrainingSession> sessionLookup)
    {
        if (completions.Count == 0 && !response.SessionExecutions.Any(e => e.IsSessionFinished))
        {
            return;
        }

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

            var finishedWorkouts = session.Workouts
                .Select(workout => new WorkoutFinishedStateDto
                {
                    WorkoutId = workout.WorkoutId,
                    IsFinished = bestCompletion.IsWorkoutComplete(session, workout)
                })
                .Where(dto => dto.IsFinished)
                .ToList();

            if (finishedWorkouts.Count == 0)
            {
                continue;
            }

            if (exec is not null)
            {
                exec.FinishedWorkouts = finishedWorkouts;
            }
            else
            {
                // No execution entry yet (partial completion with no Performance) — add a
                // synthetic entry so FinishedWorkouts is visible to the web layer.
                response.SessionExecutions.Add(new SessionExecutionDto
                {
                    SessionId = sessionId,
                    IsSessionFinished = false,
                    CompletedSetsByExercise = new Dictionary<Guid, List<int>>(),
                    FinishedWorkouts = finishedWorkouts
                });
            }
        }
    }
}
