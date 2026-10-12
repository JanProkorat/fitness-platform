using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Answers which coach roles (Trainer, Nutritionist) a user actively holds: held in Identity
/// and not marked removed on the professional profile.
/// </summary>
public interface ICoachRoleStatus
{
    /// <summary>
    /// Returns the active coach roles of an already-loaded user.
    /// </summary>
    /// <param name="user">The user whose Identity roles are read.</param>
    /// <param name="profile">The user's professional profile, or null when none exists.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<IReadOnlyList<string>> GetActiveRolesAsync(
        ApplicationUser user, ProfessionalProfile? profile, CancellationToken ct);

    /// <summary>
    /// Returns the active coach roles of a user by id; empty when the user does not exist.
    /// </summary>
    /// <param name="userId">The user id.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<IReadOnlyList<string>> GetActiveRolesAsync(Guid userId, CancellationToken ct);
}
