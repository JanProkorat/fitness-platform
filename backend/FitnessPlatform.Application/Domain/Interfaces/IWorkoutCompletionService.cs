using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Completes a <see cref="SessionExecution"/>: runs PR detection, marks the execution as
/// <see cref="Enums.SessionExecutionStatus.Completed"/> (Performance + checkbox completion
/// flags in a single write — #841 retired the best-effort cross-collection fan-out), and creates
/// a trainer notification when personal records are detected.
///
/// The completion instant drives BOTH <see cref="SessionExecutionPerformance.CompletedAt"/>
/// AND the completion-flag semantics, so that backdated finishes are attributed to the correct
/// calendar day.
/// </summary>
public interface IWorkoutCompletionService
{
    /// <summary>
    /// Completes the given session execution at the specified instant.
    /// </summary>
    /// <param name="execution">
    ///   The session execution to complete. Must have a non-null <see cref="SessionExecution.Performance"/>
    ///   and <see cref="SessionExecution.Status"/> == <see cref="Enums.SessionExecutionStatus.Partial"/>.
    ///   The document is mutated in place (Performance.CompletedAt, Status, DateUpdated) and
    ///   replaced in MongoDB inside this call.
    /// </param>
    /// <param name="completedAtUtc">
    ///   The UTC instant to record as the completion time.
    ///   Pass <see cref="DateTime.UtcNow"/> for live completions; pass a backdated value for
    ///   trainer-driven historical finishes.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The list of human-readable PR descriptions (may be empty).</returns>
    Task<List<string>> CompleteAsync(SessionExecution execution, DateTime completedAtUtc, CancellationToken ct);
}
