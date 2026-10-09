using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Marks coach roles removed on the professional profile and tells the affected clients.
/// </summary>
public interface ICoachRoleRemover
{
    /// <summary>
    /// Sets the removal marker of each role that is not yet removed (conditional update, so a rerun
    /// changes nothing), then notifies the affected clients once each. Returns the roles actually marked.
    /// </summary>
    /// <param name="coach">The coach whose roles are removed.</param>
    /// <param name="professionalProfileId">Internal id of the coach's professional profile.</param>
    /// <param name="roles">Coach roles to remove (Trainer, Nutritionist).</param>
    /// <param name="now">Removal time (UTC).</param>
    /// <param name="ct">Cancellation token.</param>
    Task<IReadOnlyList<string>> RemoveAsync(
        ApplicationUser coach,
        long professionalProfileId,
        IReadOnlyCollection<string> roles,
        DateTime now,
        CancellationToken ct);

    /// <summary>
    /// Sends one CoachRoleRemoved notification to every client whose active link grants a removed
    /// discipline. Best-effort: failures are logged and never thrown.
    /// </summary>
    /// <param name="coach">The coach whose roles were removed.</param>
    /// <param name="professionalProfileId">Internal id of the coach's professional profile.</param>
    /// <param name="roles">The removed coach roles.</param>
    /// <param name="ct">Cancellation token.</param>
    Task NotifyClientsAsync(
        ApplicationUser coach,
        long professionalProfileId,
        IReadOnlyCollection<string> roles,
        CancellationToken ct);
}
