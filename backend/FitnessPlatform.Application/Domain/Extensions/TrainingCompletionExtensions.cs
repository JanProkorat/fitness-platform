using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Extension methods for <see cref="TrainingCompletion"/> session-level completeness checks.
/// </summary>
public static class TrainingCompletionExtensions
{
    /// <summary>
    /// Returns <c>true</c> when every section in the session is done:
    /// <list type="bullet">
    ///   <item><description>Sections with exercises — every exercise id is in <see cref="TrainingCompletion.CompletedExerciseIds"/>.</description></item>
    ///   <item><description>Exercise-free sections — the SectionId is in <see cref="TrainingCompletion.CompletedSectionIds"/>.</description></item>
    /// </list>
    /// Call <see cref="TrainingSession.WithBackfilledSections"/> on <paramref name="session"/> before
    /// passing it here to ensure legacy flat-exercise documents are handled transparently.
    /// </summary>
    /// <param name="completion">The completion document to test. Must not be null.</param>
    /// <param name="session">The session definition (already backfilled). Must not be null.</param>
    public static bool IsSessionComplete(this TrainingCompletion completion, TrainingSession session)
    {
        return session.Sections.All(sec =>
            sec.Exercises.Count > 0
                ? sec.Exercises.All(e => completion.CompletedExerciseIds.Contains(e.ExerciseExternalId))
                : (completion.CompletedSectionIds ?? []).Contains(sec.SectionId));
    }
}
