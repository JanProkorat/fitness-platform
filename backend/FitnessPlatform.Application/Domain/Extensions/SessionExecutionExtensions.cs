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
    /// section is done), or every section in <paramref name="session"/> is individually complete per
    /// the checkbox flags (see <see cref="IsSectionComplete"/>).
    /// </summary>
    /// <param name="execution">The execution document to test. Must not be null.</param>
    /// <param name="session">The session definition. Must not be null.</param>
    public static bool IsSessionComplete(this SessionExecution execution, TrainingSession session)
    {
        if (execution.Status == SessionExecutionStatus.Completed)
            return true;

        // Guard: a session with no sections is never complete. Every TrainingSession document
        // carries a populated Sections list (the #837 boot migration), so zero sections signals
        // an abnormal/corrupt session definition.
        if (session.Sections.Count == 0)
            return false;

        var effectiveBySection =
            SessionExecutionBackfill.GetEffectiveCompletedExerciseIdsBySection(execution, session);

        return session.Sections.All(sec =>
            sec.Exercises.Count > 0
                ? effectiveBySection.TryGetValue(sec.SectionId, out var completedInSection)
                  && sec.Exercises.All(e => completedInSection.Contains(e.ExerciseExternalId))
                : (execution.CompletedSectionIds ?? []).Contains(sec.SectionId));
    }

    /// <summary>
    /// Returns <c>true</c> when the specified section within the session is done:
    /// <list type="bullet">
    ///   <item><description>Signal 1 — <paramref name="execution"/>.Status is
    ///     <see cref="SessionExecutionStatus.Completed"/> (session-level completion implies every
    ///     section is done).</description></item>
    ///   <item><description>Signal 2 — the checkbox flags record this specific section as complete
    ///     (exercise-free sections via <see cref="SessionExecution.CompletedSectionIds"/>;
    ///     exercise-bearing sections via
    ///     <see cref="SessionExecutionBackfill.GetEffectiveCompletedExerciseIdsBySection"/>).</description></item>
    /// </list>
    /// </summary>
    public static bool IsSectionComplete(
        this SessionExecution? execution,
        TrainingSession session,
        TrainingSection section)
    {
        if (execution is null) return false;

        // Signal 1: session-level completion implies all sections are done.
        if (execution.Status == SessionExecutionStatus.Completed) return true;

        // Exercise-free sections: completed via CompletedSectionIds.
        if (section.Exercises.Count == 0)
            return (execution.CompletedSectionIds ?? []).Contains(section.SectionId);

        // Exercise-bearing sections: use section-aware effective map to prevent
        // cross-section false positives when the same exercise appears in two sections.
        var effectiveBySection =
            SessionExecutionBackfill.GetEffectiveCompletedExerciseIdsBySection(execution, session);

        return effectiveBySection.TryGetValue(section.SectionId, out var completedInSection)
               && section.Exercises.All(e => completedInSection.Contains(e.ExerciseExternalId));
    }
}
