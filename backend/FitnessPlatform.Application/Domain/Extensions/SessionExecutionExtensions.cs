using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Extension methods for <see cref="SessionExecution"/> session-level completeness checks.
/// Mirrors the retired <c>TrainingCompletionExtensions</c>, with one simplification: since a
/// finished live workout (formerly a separate <c>WorkoutLog.IsCompleted</c> signal) and the
/// checkbox completion flags now live on the SAME document, "is this session/workout done" no
/// longer needs an externally-supplied <c>hasCompletedWorkoutLog</c> boolean — it's read straight
/// off <see cref="SessionExecution.Status"/>.
/// </summary>
/// <remarks>
/// #857 phase 3b: <see cref="SessionExecution.CompletedExerciseInstanceIds"/> holds
/// <see cref="SessionExercise.ExerciseId"/> instance values, which already disambiguate two
/// occurrences of the same catalog exercise (in one workout, across workouts, or standalone vs.
/// nested) — so a flat membership check is sufficient and correct. This removes the need for the
/// retired per-workout "effective" backfill map that the pre-#857-phase-3b
/// <c>CompletedExerciseIdsBySection</c> dictionary required.
/// </remarks>
public static class SessionExecutionExtensions
{
    /// <summary>
    /// Idempotency-only short-circuit — NOT the placement-exact completion rule (see
    /// <see cref="ResolveCompletedInstanceIds"/> for that one). Returns <c>true</c> when the session
    /// is fully done: either <see cref="SessionExecution.Status"/> is already
    /// <see cref="SessionExecutionStatus.Completed"/> (a finished live workout implies every workout
    /// is done), or every workout and standalone exercise in <paramref name="session"/> is
    /// individually complete per the checkbox flags (see <see cref="IsWorkoutComplete"/>).
    /// </summary>
    /// <remarks>
    /// Deliberately Performance-blind and deliberately left unchanged by #938 — it never inspects
    /// <see cref="SessionExecution.Performance"/>, only <see cref="SessionExecution.Status"/> and the
    /// flat checkbox-driven <see cref="SessionExecution.CompletedExerciseInstanceIds"/> list. Its 8
    /// call sites (<c>UnlockTrainingSessionEndpoint</c>, <c>ComplianceService</c>,
    /// <c>GetTrainingPlanEndpoint</c>, <c>UpdateTrainingPlanEndpoint</c>,
    /// <c>TrainingProgressBroadcaster</c>, and the <c>MarkSessionComplete</c>/<c>MarkWholeDayComplete</c>
    /// idempotency checks) use it purely to decide "has this already been fully marked done" or to
    /// gate a business rule (session-unlock, compliance percentage) that must NOT silently move when
    /// the placement-exact read model changes. Folding Performance-awareness in here would move
    /// compliance percentages — a separate, un-reviewed decision, not a refactor.
    /// </remarks>
    /// <param name="execution">The execution document to test. Must not be null.</param>
    /// <param name="session">The session definition. Must not be null.</param>
    public static bool IsSessionComplete(this SessionExecution execution, TrainingSession session)
    {
        if (execution.Status == SessionExecutionStatus.Completed)
            return true;

        // Guard: a session with nothing programmed (no workouts, no standalone exercises) is
        // never complete. A session is written with at least one workout or one standalone
        // exercise (#857 phase 3a — enforced by UpdateTrainingPlanValidator), so zero of both
        // signals an abnormal/corrupt session definition.
        if (session.Workouts.Count == 0 && session.StandaloneExercises.Count == 0)
            return false;

        var completedInstanceIds = execution.CompletedExerciseInstanceIds;

        var workoutsComplete = session.Workouts.All(workout =>
            workout.Exercises.Count > 0
                ? workout.Exercises.All(e => completedInstanceIds.Contains(e.ExerciseId))
                : (execution.CompletedWorkoutIds ?? []).Contains(workout.WorkoutId));

        var standaloneComplete = session.StandaloneExercises.All(e => completedInstanceIds.Contains(e.ExerciseId));

        return workoutsComplete && standaloneComplete;
    }

    /// <summary>
    /// Returns <c>true</c> when the specified workout within the session is done:
    /// <list type="bullet">
    ///   <item><description>Signal 1 — <paramref name="execution"/>.Status is
    ///     <see cref="SessionExecutionStatus.Completed"/> (session-level completion implies every
    ///     workout is done).</description></item>
    ///   <item><description>Signal 2 — the checkbox flags record this specific workout as complete
    ///     (exercise-free workouts via <see cref="SessionExecution.CompletedWorkoutIds"/>;
    ///     exercise-bearing workouts via a direct
    ///     <see cref="SessionExecution.CompletedExerciseInstanceIds"/> membership check).</description></item>
    /// </list>
    /// </summary>
    public static bool IsWorkoutComplete(
        this SessionExecution? execution,
        TrainingSession session,
        TrainingWorkout workout)
    {
        if (execution is null) return false;

        // Signal 1: session-level completion implies all workouts are done.
        if (execution.Status == SessionExecutionStatus.Completed) return true;

        // Exercise-free workouts: completed via CompletedWorkoutIds.
        if (workout.Exercises.Count == 0)
            return (execution.CompletedWorkoutIds ?? []).Contains(workout.WorkoutId);

        // Exercise-bearing workouts: every exercise instance in this specific workout must be
        // present in the flat completed-instance list.
        return workout.Exercises.All(e => execution.CompletedExerciseInstanceIds.Contains(e.ExerciseId));
    }

    /// <summary>
    /// The canonical placement-exact completion rule (#938). Resolves every
    /// <see cref="SessionExercise.ExerciseId"/> placement considered complete for
    /// <paramref name="execution"/> against <paramref name="session"/>, unioning two signals:
    /// <list type="number">
    /// <item>The raw checkbox path — <see cref="SessionExecution.CompletedExerciseInstanceIds"/>
    /// already holds instance ids verbatim, carried straight through.</item>
    /// <item>Performance data — a fully-logged catalog exercise (every
    /// <see cref="WorkoutSet.CompletedAt"/> non-null) is attributed via
    /// <see cref="ResolveMatchedPlacements"/>: placement-exact when its containing
    /// <see cref="LoggedWorkout.WorkoutId"/> resolves to exactly one instance, a tied-instance
    /// fan-out when it resolves to more than one (the same catalog exercise placed twice under the
    /// same workout, or twice standalone), or a session-wide catalog fan-out when attribution is
    /// genuinely impossible.</item>
    /// </list>
    /// </summary>
    /// <param name="execution">The execution document to resolve. Must not be null.</param>
    /// <param name="session">The session definition. Must not be null.</param>
    public static ISet<Guid> ResolveCompletedInstanceIds(this SessionExecution execution, TrainingSession session)
    {
        var completedInstanceIds = new HashSet<Guid>(execution.CompletedExerciseInstanceIds);

        if (execution.Performance is null)
        {
            return completedInstanceIds;
        }

        foreach (var workout in execution.Performance.Workouts)
        {
            var workoutKey = session.ResolveLoggedWorkoutKey(workout.WorkoutId);

            foreach (var exercise in workout.Exercises)
            {
                if (exercise.Sets.Count == 0 || !exercise.Sets.All(s => s.CompletedAt is not null))
                {
                    continue;
                }

                foreach (var placement in session.ResolveMatchedPlacements(workoutKey, exercise.ExerciseExternalId))
                {
                    completedInstanceIds.Add(placement.ExerciseId);
                }
            }
        }

        return completedInstanceIds;
    }

    /// <summary>
    /// Resolves a Performance-side <see cref="LoggedWorkout.WorkoutId"/> to the key used by
    /// <see cref="ResolveMatchedPlacements"/>: the same id when it matches a real nested
    /// <see cref="TrainingWorkout"/> in <paramref name="session"/>, else <c>null</c> — the shape the
    /// legacy single-workout fallback id (<c>UpdateWorkoutEndpoint</c>'s WorkoutId assigned when the
    /// client sends none) takes.
    /// </summary>
    public static Guid? ResolveLoggedWorkoutKey(this TrainingSession session, Guid loggedWorkoutId) =>
        session.Workouts.Any(w => w.WorkoutId == loggedWorkoutId) ? loggedWorkoutId : null;

    /// <summary>
    /// Resolves the <see cref="SessionExercise"/> placement(s) a Performance-logged
    /// (<paramref name="workoutKey"/>, <paramref name="catalogExerciseExternalId"/>) pair
    /// attributes to. Three outcomes, in order:
    /// <list type="number">
    /// <item><b>Placement-exact</b> — exactly one instance shares this key (the common case:
    /// a workout's exercise, or a standalone exercise, that appears nowhere else under the same
    /// container).</item>
    /// <item><b>Tied-instance fan-out</b> — 2+ instances share this key (the same catalog exercise
    /// placed twice in the SAME workout, or twice standalone — genuinely unresolvable, since
    /// <see cref="WorkoutExercise"/> carries neither an instance id nor an order). Every tied
    /// instance is returned, never just the whole session.</item>
    /// <item><b>Unattributable session-wide fan-out</b> — no instance shares this exact key at all
    /// (e.g. <paramref name="workoutKey"/> is the legacy single-workout fallback id and the catalog
    /// exercise has no standalone placement either). Falls back to every
    /// <see cref="TrainingSession.AllExercises"/> instance sharing the catalog id — today's
    /// behaviour, unchanged for this genuinely-ambiguous case.</item>
    /// </list>
    /// </summary>
    public static IReadOnlyList<SessionExercise> ResolveMatchedPlacements(
        this TrainingSession session, Guid? workoutKey, Guid catalogExerciseExternalId)
    {
        var exactMatches = session.Workouts
            .SelectMany(w => w.Exercises.Select(e => (WorkoutKey: (Guid?)w.WorkoutId, Instance: e)))
            .Concat(session.StandaloneExercises.Select(e => (WorkoutKey: (Guid?)null, Instance: e)))
            .Where(placement => placement.WorkoutKey == workoutKey && placement.Instance.ExerciseExternalId == catalogExerciseExternalId)
            .Select(placement => placement.Instance)
            .ToList();

        if (exactMatches.Count > 0)
        {
            return exactMatches;
        }

        return session.AllExercises
            .Where(e => e.ExerciseExternalId == catalogExerciseExternalId)
            .ToList();
    }
}
