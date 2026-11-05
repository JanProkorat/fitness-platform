using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// Default <see cref="ICoachDisciplineAccess"/>, reading the caller's held Identity roles.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class CoachDisciplineAccess(UserManager<ApplicationUser> userManager) : ICoachDisciplineAccess
{
    /// <inheritdoc />
    public async Task<LinkCapabilities> GetEffectiveAsync(
        Guid coachUserId, LinkCapabilities linkCapabilities, CancellationToken ct)
    {
        if (linkCapabilities.GrantsNothing)
        {
            return linkCapabilities;
        }

        var user = await userManager.FindByIdAsync(coachUserId.ToString());

        if (user is null)
        {
            return new LinkCapabilities(false, false);
        }

        var heldRoles = await userManager.GetRolesAsync(user);

        return new LinkCapabilities(
            linkCapabilities.CanViewNutritionPlans && heldRoles.Contains(AppRoles.Nutritionist),
            linkCapabilities.CanViewTrainingPlans && heldRoles.Contains(AppRoles.Trainer));
    }
}
