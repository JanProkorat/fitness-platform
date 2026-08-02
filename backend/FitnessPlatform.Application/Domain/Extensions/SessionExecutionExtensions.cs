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
    /// Returns <c>true</c> when the session is fully done: either <see cref="SessionExecution.Status"/>
    /// is already <see cref="SessionExecutionStatus.Completed"/> (a finished live workout implies every
    /// workout is done), or every workout and standalone exercise in <paramref name="session"/> is
    /// individually complete per the checkbox flags (see <see cref="IsWorkoutComplete"/>).
    /// </summary>
    /// <param name="execution">The execution document to test. Must not be null.</param>
    /// <param name="session">The session definition. Must not be null.</param>
    public static bool IsSessionComplete(this SessionExecution execution, TrainingSession session)
    {
        if (execution.Status == SessionExecutionStatus.Completed)
            return true;

        // Guard: a session with nothing programmed (no workouts, no standalone exercises) is
        // never complete. Every TrainingSession document carries a populated Workouts list (the
        // #837 boot migration) or standalone exercises (#857 phase 3a), so zero of both signals an
        // abnormal/corrupt session definition.
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
}
