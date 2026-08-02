using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Extension methods for <see cref="TrainingCompletion"/> session-level completeness checks.
/// </summary>
/// <remarks>
/// #857 phase 3b: <see cref="TrainingCompletion.CompletedExerciseInstanceIds"/> holds
/// <see cref="SessionExercise.ExerciseId"/> instance values, which already disambiguate two
/// occurrences of the same catalog exercise (in one workout, across workouts, or standalone vs.
/// nested) — so a flat membership check is sufficient and correct. This removes the need for the
/// retired per-workout "effective" backfill map that the pre-#857-phase-3b
/// <c>CompletedExerciseIdsBySection</c> dictionary required.
/// </remarks>
public static class TrainingCompletionExtensions
{
    /// <summary>
    /// Returns <c>true</c> when the specified workout within the session is done, using the
    /// two-signal model:
    /// <list type="bullet">
    ///   <item><description>Signal 1 — a completed <c>WorkoutLog</c> exists for the session
    ///     (<paramref name="hasCompletedWorkoutLog"/>). Session-level completion implies every
    ///     workout is done.</description></item>
    ///   <item><description>Signal 2 — the <c>TrainingCompletion</c> document records every
    ///     exercise instance in this workout as complete (exercise-free workouts via
    ///     <see cref="TrainingCompletion.CompletedWorkoutIds"/>; exercise-bearing workouts via a
    ///     direct <see cref="TrainingCompletion.CompletedExerciseInstanceIds"/> membership
    ///     check).</description></item>
    /// </list>
    /// </summary>
    public static bool IsWorkoutComplete(
        this TrainingCompletion? completion,
        TrainingSession session,
        TrainingWorkout workout,
        bool hasCompletedWorkoutLog)
    {
        // Signal 1: session-level completion from WorkoutLog implies all workouts are done.
        if (hasCompletedWorkoutLog) return true;

        if (completion is null) return false;

        // Exercise-free workouts: completed via CompletedWorkoutIds.
        if (workout.Exercises.Count == 0)
            return (completion.CompletedWorkoutIds ?? []).Contains(workout.WorkoutId);

        // Exercise-bearing workouts: every exercise instance in this specific workout must be
        // present in the flat completed-instance list.
        return workout.Exercises.All(e => completion.CompletedExerciseInstanceIds.Contains(e.ExerciseId));
    }

    /// <summary>
    /// Returns <c>true</c> when every workout (and standalone exercise) in the session is done —
    /// see <see cref="IsWorkoutComplete"/> for the per-workout rule.
    /// <para>
    /// A session with nothing programmed (no workouts, no standalone exercises) is <b>never</b>
    /// considered complete — every <see cref="TrainingSession"/> document carries a populated
    /// <see cref="TrainingSession.Workouts"/> list (the one-time boot migration in
    /// <c>MongoIndexInitializer</c>, #837) or standalone exercises (#857 phase 3a), so zero of
    /// both signals an abnormal/corrupt session definition.
    /// </para>
    /// </summary>
    public static bool IsSessionComplete(this TrainingCompletion completion, TrainingSession session)
    {
        if (session.Workouts.Count == 0 && session.StandaloneExercises.Count == 0)
            return false;

        var workoutsComplete = session.Workouts.All(workout =>
            workout.Exercises.Count > 0
                ? workout.Exercises.All(e => completion.CompletedExerciseInstanceIds.Contains(e.ExerciseId))
                : (completion.CompletedWorkoutIds ?? []).Contains(workout.WorkoutId));

        var standaloneComplete = session.StandaloneExercises.All(
            e => completion.CompletedExerciseInstanceIds.Contains(e.ExerciseId));

        return workoutsComplete && standaloneComplete;
    }
}
