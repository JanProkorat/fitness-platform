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
    /// A session with zero sections is <b>never</b> considered complete — callers must ensure
    /// <see cref="TrainingSession.WithBackfilledSections"/> has been called on
    /// <paramref name="session"/> before invoking this helper so that legacy flat-exercise
    /// sessions get their synthetic section, making zero-section the abnormal/corrupt case.
    /// </para>
    /// Call <see cref="TrainingSession.WithBackfilledSections"/> on <paramref name="session"/> before
    /// passing it here to ensure legacy flat-exercise documents are handled transparently.
    /// </summary>
    /// <param name="completion">The completion document to test. Must not be null.</param>
    /// <param name="session">The session definition (already backfilled). Must not be null.</param>
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
    public static bool IsSectionComplete(
        this TrainingCompletion? completion,
        TrainingSession session,
        TrainingSection section,
        bool hasCompletedWorkoutLog)
    {
        // Signal 1: session-level completion from WorkoutLog implies all sections are done.
        if (hasCompletedWorkoutLog) return true;

        if (completion is null) return false;

        // Exercise-free sections: completed via CompletedSectionIds.
        if (section.Exercises.Count == 0)
            return (completion.CompletedSectionIds ?? []).Contains(section.SectionId);

        // Exercise-bearing sections: use section-aware effective map to prevent
        // cross-section false positives when the same exercise appears in two sections.
        var effectiveBySection =
            TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(completion, session);

        return effectiveBySection.TryGetValue(section.SectionId, out var completedInSection)
               && section.Exercises.All(e => completedInSection.Contains(e.ExerciseExternalId));
    }

    public static bool IsSessionComplete(this TrainingCompletion completion, TrainingSession session)
    {
        // Guard: a session with no sections is never complete.
        // After WithBackfilledSections() a legacy flat-exercise session always has at least one
        // synthetic section, so zero sections signals an empty/corrupt session definition.
        if (session.Sections.Count == 0)
            return false;

        // Build the section-aware effective view using the authoritative per-section dict
        // (falls back to the legacy flat list via backfill for older documents). This avoids
        // the false-positive where the same exercise id appears in two sections and the flat
        // CompletedExerciseIds list treats both as complete when only one was actually done.
        var effectiveBySection =
            TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(completion, session);

        return session.Sections.All(sec =>
            sec.Exercises.Count > 0
                ? effectiveBySection.TryGetValue(sec.SectionId, out var completedInSection)
                  && sec.Exercises.All(e => completedInSection.Contains(e.ExerciseExternalId))
                : (completion.CompletedSectionIds ?? []).Contains(sec.SectionId));
    }
}
