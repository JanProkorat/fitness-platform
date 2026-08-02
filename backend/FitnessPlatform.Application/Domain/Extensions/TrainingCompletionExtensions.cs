using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.ClientTraining;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Extension methods for <see cref="TrainingCompletion"/> session-level completeness checks.
/// </summary>
public static class TrainingCompletionExtensions
{
    /// <summary>
    /// Returns <c>true</c> when every section in the session is done:
    /// <list type="bullet">
    ///   <item><description>Sections with exercises — every exercise id is present in the
    ///     per-section effective map produced by
    ///     <see cref="TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection"/>
    ///     for that specific section instance. This prevents a duplicate exercise id that spans
    ///     two sections (e.g. the same movement in two AMRAP blocks) from being treated as
    ///     done in both sections when it was only completed in one.</description></item>
    ///   <item><description>Exercise-free sections — the SectionId is in
    ///     <see cref="TrainingCompletion.CompletedSectionIds"/>.</description></item>
    /// </list>
    /// <para>
    /// A session with zero sections is <b>never</b> considered complete — every
    /// <see cref="TrainingSession"/> document carries a populated <see cref="TrainingSession.Workouts"/>
    /// list (the one-time boot migration in <c>MongoIndexInitializer</c>, #837, backfilled every
    /// legacy flat-exercise document into a synthetic section), so zero sections signals an
    /// abnormal/corrupt session definition.
    /// </para>
    /// </summary>
    /// <param name="completion">The completion document to test. Must not be null.</param>
    /// <param name="session">The session definition. Must not be null.</param>
    /// <summary>
    /// Returns <c>true</c> when the specified section within the session is done, using the
    /// two-signal model:
    /// <list type="bullet">
    ///   <item><description>Signal 1 — a completed <c>WorkoutLog</c> exists for the session
    ///     (<paramref name="hasCompletedWorkoutLog"/>). Session-level completion implies every
    ///     section is done.</description></item>
    ///   <item><description>Signal 2 — the <c>TrainingCompletion</c> document records this
    ///     section as complete (exercise-free sections via <see cref="TrainingCompletion.CompletedSectionIds"/>;
    ///     exercise-bearing sections via
    ///     <see cref="TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection"/>).</description></item>
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

        // Exercise-free workouts: completed via CompletedSectionIds.
        if (workout.Exercises.Count == 0)
            return (completion.CompletedSectionIds ?? []).Contains(workout.WorkoutId);

        // Exercise-bearing workouts: use workout-aware effective map to prevent
        // cross-workout false positives when the same exercise appears in two workouts.
        var effectiveByWorkout =
            TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(completion, session);

        return effectiveByWorkout.TryGetValue(workout.WorkoutId, out var completedInWorkout)
               && workout.Exercises.All(e => completedInWorkout.Contains(e.ExerciseExternalId));
    }

    public static bool IsSessionComplete(this TrainingCompletion completion, TrainingSession session)
    {
        // Guard: a session with no workouts is never complete. Every TrainingSession document
        // carries a populated Workouts list (see the boot migration in MongoIndexInitializer,
        // #837), so zero workouts signals an empty/corrupt session definition.
        if (session.Workouts.Count == 0)
            return false;

        // Build the workout-aware effective view using the authoritative per-workout dict
        // (falls back to the flat mirror list for the rare doc the boot migration could not
        // resolve a session for). This avoids the false-positive where the same exercise id
        // appears in two workouts and the flat CompletedExerciseIds list treats both as
        // complete when only one was actually done.
        var effectiveByWorkout =
            TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(completion, session);

        return session.Workouts.All(workout =>
            workout.Exercises.Count > 0
                ? effectiveByWorkout.TryGetValue(workout.WorkoutId, out var completedInWorkout)
                  && workout.Exercises.All(e => completedInWorkout.Contains(e.ExerciseExternalId))
                : (completion.CompletedSectionIds ?? []).Contains(workout.WorkoutId));
    }
}
