using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Narrows a link's capability flags to the disciplines the calling coach holds a role for.
/// </summary>
public interface ICoachDisciplineAccess
{
    /// <summary>
    /// Returns the link flags ANDed with the caller's held roles: nutrition needs the Nutritionist role,
    /// training needs the Trainer role. A role marked removed still counts until the sweeper ends the link.
    /// </summary>
    /// <param name="coachUserId">The calling coach's user id.</param>
    /// <param name="linkCapabilities">The flags stamped on the link.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<LinkCapabilities> GetEffectiveAsync(Guid coachUserId, LinkCapabilities linkCapabilities, CancellationToken ct);
}
