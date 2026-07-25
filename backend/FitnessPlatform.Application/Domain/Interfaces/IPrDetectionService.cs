using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Detects personal records by comparing workout sets against historical bests.
/// </summary>
public interface IPrDetectionService
{
    /// <summary>
    /// Checks all sets in the session execution's Performance data for personal records and
    /// marks them. Returns the list of PR descriptions for notification purposes.
    /// </summary>
    /// <param name="execution">The completed session execution to check (must have Performance set).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of human-readable PR descriptions (e.g. "Bench Press: 60 kg x 8").</returns>
    Task<List<string>> DetectAndMarkPRsAsync(SessionExecution execution, CancellationToken ct);
}
