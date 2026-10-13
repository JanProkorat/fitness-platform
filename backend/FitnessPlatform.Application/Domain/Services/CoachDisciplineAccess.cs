using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Default <see cref="ICoachDisciplineAccess"/>, resolving active roles through <see cref="ICoachRoleStatus"/>.
/// </summary>
/// <param name="coachRoleStatus">Resolves the caller's active coach roles.</param>
public class CoachDisciplineAccess(ICoachRoleStatus coachRoleStatus) : ICoachDisciplineAccess
{
    /// <inheritdoc />
    public async Task<LinkCapabilities> GetEffectiveAsync(
        Guid coachUserId, LinkCapabilities linkCapabilities, CancellationToken ct)
    {
        if (linkCapabilities.GrantsNothing)
        {
            return linkCapabilities;
        }

        var activeRoles = await coachRoleStatus.GetActiveRolesAsync(coachUserId, ct);

        return new LinkCapabilities(
            linkCapabilities.CanViewNutritionPlans && activeRoles.Contains(AppRoles.Nutritionist),
            linkCapabilities.CanViewTrainingPlans && activeRoles.Contains(AppRoles.Trainer));
    }
}
