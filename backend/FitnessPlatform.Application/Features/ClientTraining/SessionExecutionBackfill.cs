using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientTraining;

/// <summary>
/// Read-time backfill utilities for <see cref="SessionExecution"/> documents.
/// </summary>
/// <remarks>
/// Mirrors the algorithm in <see cref="TrainingCompletionBackfill"/> (retained for reading legacy
/// <see cref="TrainingCompletion"/> documents during the <c>--migrate-session-executions</c>
/// migration) — kept as a separate small copy rather than a shared generic helper because the two
/// source types (<see cref="TrainingCompletion"/> read-only legacy vs. <see cref="SessionExecution"/>
/// live) diverge in lifecycle and this is the only other call site (rule of three not yet met).
/// New writes populate <c>CompletedExerciseIdsBySection</c>; this helper bridges the gap for
/// documents (e.g. migrated from legacy TrainingCompletion) that only carry the flat
/// <c>CompletedExerciseIds</c> list, so all read paths always see a section-aware view.
/// </remarks>
public static class SessionExecutionBackfill
{
    /// <summary>
    /// Returns a merged, section-aware view of which exercises are complete in each section.
    /// </summary>
    /// <param name="execution">The <see cref="SessionExecution"/> document to read.</param>
    /// <param name="session">The <see cref="TrainingSession"/> the execution belongs to.</param>
    /// <returns>
    ///   A dictionary keyed by <see cref="TrainingWorkout.WorkoutId"/>, each value being a
    ///   <see cref="HashSet{Guid}"/> of completed <see cref="SessionExercise.ExerciseExternalId"/> values.
    /// </returns>
    public static Dictionary<Guid, HashSet<Guid>> GetEffectiveCompletedExerciseIdsBySection(
        SessionExecution execution,
        TrainingSession session)
    {
        // Start from the authoritative dict (copy so we don't mutate the document).
        var result = new Dictionary<Guid, HashSet<Guid>>();

        if (execution.CompletedExerciseIdsBySection is not null)
        {
            foreach (var (sectionKey, exerciseIds) in execution.CompletedExerciseIdsBySection)
            {
                // Keys are stored as lowercase Guid strings. Skip malformed entries rather than throw.
                if (!Guid.TryParse(sectionKey, out var sectionId))
                    continue;
                result[sectionId] = new HashSet<Guid>(exerciseIds);
            }
        }

        // Collect all exercise ids already represented in the section dict so we don't double-count.
        var alreadyAttributed = result.Values
            .SelectMany(ids => ids)
            .ToHashSet();

        // Build a lookup: exerciseExternalId → first workout in session that contains it.
        var exerciseToSection = new Dictionary<Guid, Guid>();
        foreach (var workout in session.Workouts)
        {
            foreach (var exercise in workout.Exercises)
            {
                // First workout wins — matches the "attribute to first matching workout" contract.
                if (!exerciseToSection.ContainsKey(exercise.ExerciseExternalId))
                    exerciseToSection[exercise.ExerciseExternalId] = workout.WorkoutId;
            }
        }

        // Attribute legacy flat ids to sections.
        foreach (var exerciseId in execution.CompletedExerciseIds)
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
