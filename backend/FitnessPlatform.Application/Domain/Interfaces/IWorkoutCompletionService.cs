using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Completes a workout log: runs PR detection, marks the log as done, fans out a
/// <see cref="TrainingCompletion"/> document for compliance/streak, and creates a
/// trainer notification when personal records are detected.
///
/// The completion instant drives BOTH <see cref="WorkoutLog.CompletedAt"/>
/// AND the <see cref="TrainingCompletion"/> date key, so that backdated finishes are
/// attributed to the correct calendar day.
/// </summary>
public interface IWorkoutCompletionService
{
    /// <summary>
    /// Completes the given workout log at the specified instant.
    /// </summary>
    /// <param name="log">
    ///   The workout log to complete. Must have <see cref="WorkoutLog.IsCompleted"/> == false.
    ///   The document is mutated in place (CompletedAt, IsCompleted, DateUpdated) and
    ///   replaced in MongoDB inside this call.
    /// </param>
    /// <param name="completedAtUtc">
    ///   The UTC instant to record as the completion time. Used for both
    ///   <see cref="WorkoutLog.CompletedAt"/> and the <see cref="TrainingCompletion"/> date key.
    ///   Pass <see cref="DateTime.UtcNow"/> for live completions; pass a backdated value for
    ///   trainer-driven historical finishes.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The list of human-readable PR descriptions (may be empty).</returns>
    Task<List<string>> CompleteAsync(WorkoutLog log, DateTime completedAtUtc, CancellationToken ct);
}
