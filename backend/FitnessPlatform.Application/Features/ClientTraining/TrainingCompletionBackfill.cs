using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientTraining;

/// <summary>
/// Read-time backfill utilities for <see cref="TrainingCompletion"/> documents.
/// </summary>
/// <remarks>
/// New writes populate <c>CompletedExerciseIdsBySection</c>; this helper bridges the gap for
/// legacy documents that only carry the flat <c>CompletedExerciseIds</c> list so that all read
/// paths (compliance checks, response builders) always see a section-aware view.
/// </remarks>
public static class TrainingCompletionBackfill
{
    /// <summary>
    /// Returns a merged, section-aware view of which exercises are complete in each section.
    /// </summary>
    /// <remarks>
    /// Algorithm:
    /// <list type="number">
    ///   <item>Start from <c>completion.CompletedExerciseIdsBySection</c> (may be null).</item>
    ///   <item>
    ///     For every exercise id in the legacy flat <c>CompletedExerciseIds</c> list that is NOT
    ///     already represented in the section dict, find the first section in <paramref name="session"/>
    ///     whose exercises contain that id and attribute it there.
    ///   </item>
    ///   <item>Return the merged copy. The original document is not mutated.</item>
    /// </list>
    /// </remarks>
    /// <param name="completion">The <see cref="TrainingCompletion"/> document to read.</param>
    /// <param name="session">The <see cref="TrainingSession"/> the completion belongs to.</param>
    /// <returns>
    ///   A dictionary keyed by <see cref="TrainingSection.SectionId"/>, each value being a
    ///   <see cref="HashSet{Guid}"/> of completed <see cref="SessionExercise.ExerciseExternalId"/> values.
    /// </returns>
    public static Dictionary<Guid, HashSet<Guid>> GetEffectiveCompletedExerciseIdsBySection(
        TrainingCompletion completion,
        TrainingSession session)
    {
        // Start from the authoritative dict (copy so we don't mutate the document).
        var result = new Dictionary<Guid, HashSet<Guid>>();

        if (completion.CompletedExerciseIdsBySection is not null)
        {
            foreach (var (sectionKey, exerciseIds) in completion.CompletedExerciseIdsBySection)
            {
                // Keys are stored as lowercase Guid strings (e.g. "3f2504e0-4f89-...").
                // Skip malformed entries from any hypothetical corrupt document rather than throw.
                if (!Guid.TryParse(sectionKey, out var sectionId))
                    continue;
                result[sectionId] = new HashSet<Guid>(exerciseIds);
            }
        }

        // Collect all exercise ids already represented in the section dict so we don't double-count.
        var alreadyAttributed = result.Values
            .SelectMany(ids => ids)
            .ToHashSet();

        // Build a lookup: exerciseExternalId → first section in session that contains it.
        // We only need to iterate sections once to build this reverse map.
        var exerciseToSection = new Dictionary<Guid, Guid>();
        foreach (var section in session.Sections)
        {
            foreach (var exercise in section.Exercises)
            {
                // First section wins — matches the "attribute to first matching section" contract.
                if (!exerciseToSection.ContainsKey(exercise.ExerciseExternalId))
                    exerciseToSection[exercise.ExerciseExternalId] = section.SectionId;
            }
        }

        // Attribute legacy flat ids to sections.
        foreach (var exerciseId in completion.CompletedExerciseIds)
        {
            if (alreadyAttributed.Contains(exerciseId))
                continue;

            if (!exerciseToSection.TryGetValue(exerciseId, out var sectionId))
                continue; // exercise no longer in session — skip

            if (!result.TryGetValue(sectionId, out var set))
                result[sectionId] = set = [];

            set.Add(exerciseId);
        }

        return result;
    }
}
