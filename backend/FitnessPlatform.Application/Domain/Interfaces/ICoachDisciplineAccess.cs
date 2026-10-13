using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Narrows a link's capability flags to the disciplines the calling coach still holds an active role for.
/// </summary>
public interface ICoachDisciplineAccess
{
    /// <summary>
    /// Returns the link flags ANDed with the caller's active roles: nutrition needs an active Nutritionist
    /// role, training needs an active Trainer role. A role removed on the profile does not count.
    /// </summary>
    /// <param name="coachUserId">The calling coach's user id.</param>
    /// <param name="linkCapabilities">The flags stamped on the link.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<LinkCapabilities> GetEffectiveAsync(Guid coachUserId, LinkCapabilities linkCapabilities, CancellationToken ct);
}
