using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientTraining;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Extension methods for <see cref="SessionExecution"/> session-level completeness checks.
/// Mirrors the retired <c>TrainingCompletionExtensions</c>, with one simplification: since a
/// finished live workout (formerly a separate <c>WorkoutLog.IsCompleted</c> signal) and the
/// checkbox completion flags now live on the SAME document, "is this session/section done" no
/// longer needs an externally-supplied <c>hasCompletedWorkoutLog</c> boolean — it's read straight
/// off <see cref="SessionExecution.Status"/>.
/// </summary>
public static class SessionExecutionExtensions
{
    /// <summary>
    /// Returns <c>true</c> when the session is fully done: either <see cref="SessionExecution.Status"/>
    /// is already <see cref="SessionExecutionStatus.Completed"/> (a finished live workout implies every
    /// workout is done), or every workout in <paramref name="session"/> is individually complete per
    /// the checkbox flags (see <see cref="IsWorkoutComplete"/>).
    /// </summary>
    /// <param name="execution">The execution document to test. Must not be null.</param>
    /// <param name="session">The session definition. Must not be null.</param>
    public static bool IsSessionComplete(this SessionExecution execution, TrainingSession session)
    {
        if (execution.Status == SessionExecutionStatus.Completed)
            return true;

        // Guard: a session with no workouts is never complete. Every TrainingSession document
        // carries a populated Workouts list (the #837 boot migration), so zero workouts signals
        // an abnormal/corrupt session definition.
        if (session.Workouts.Count == 0)
            return false;

        var effectiveByWorkout =
            SessionExecutionBackfill.GetEffectiveCompletedExerciseIdsBySection(execution, session);

        return session.Workouts.All(workout =>
            workout.Exercises.Count > 0
                ? effectiveByWorkout.TryGetValue(workout.WorkoutId, out var completedInWorkout)
                  && workout.Exercises.All(e => completedInWorkout.Contains(e.ExerciseExternalId))
                : (execution.CompletedWorkoutIds ?? []).Contains(workout.WorkoutId));
    }

    /// <summary>
    /// Returns <c>true</c> when the specified workout within the session is done:
    /// <list type="bullet">
    ///   <item><description>Signal 1 — <paramref name="execution"/>.Status is
    ///     <see cref="SessionExecutionStatus.Completed"/> (session-level completion implies every
    ///     workout is done).</description></item>
    ///   <item><description>Signal 2 — the checkbox flags record this specific workout as complete
    ///     (exercise-free workouts via <see cref="SessionExecution.CompletedWorkoutIds"/>;
    ///     exercise-bearing workouts via
    ///     <see cref="SessionExecutionBackfill.GetEffectiveCompletedExerciseIdsBySection"/>).</description></item>
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

        // Exercise-free workouts: completed via CompletedSectionIds.
        if (workout.Exercises.Count == 0)
            return (execution.CompletedWorkoutIds ?? []).Contains(workout.WorkoutId);

        // Exercise-bearing workouts: use workout-aware effective map to prevent
        // cross-workout false positives when the same exercise appears in two workouts.
        var effectiveByWorkout =
            SessionExecutionBackfill.GetEffectiveCompletedExerciseIdsBySection(execution, session);

        return effectiveByWorkout.TryGetValue(workout.WorkoutId, out var completedInWorkout)
               && workout.Exercises.All(e => completedInWorkout.Contains(e.ExerciseExternalId));
    }
}
