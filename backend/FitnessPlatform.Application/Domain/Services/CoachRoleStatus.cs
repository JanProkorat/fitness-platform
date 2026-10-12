using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Default <see cref="ICoachRoleStatus"/>. The pure static helpers are shared by endpoints that
/// already hold the user's roles and profile.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="db">Database context.</param>
public class CoachRoleStatus(UserManager<ApplicationUser> userManager, IApplicationDbContext db) : ICoachRoleStatus
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<string>> GetActiveRolesAsync(
        ApplicationUser user, ProfessionalProfile? profile, CancellationToken ct)
    {
        var heldRoles = await userManager.GetRolesAsync(user);
        return ActiveRoles(heldRoles, profile);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<string>> GetActiveRolesAsync(Guid userId, CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());

        if (user is null)
        {
            return [];
        }

        var profile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        return await GetActiveRolesAsync(user, profile, ct);
    }

    /// <summary>
    /// Filters held Identity roles down to the coach roles that are not marked removed.
    /// </summary>
    /// <param name="heldRoles">All Identity roles of the user.</param>
    /// <param name="profile">The user's professional profile, or null when none exists.</param>
    public static IReadOnlyList<string> ActiveRoles(IEnumerable<string> heldRoles, ProfessionalProfile? profile) =>
        heldRoles
            .Where(role => role is AppRoles.Trainer or AppRoles.Nutritionist)
            .Where(role => !IsRemoved(profile, role))
            .ToList();

    /// <summary>
    /// Resolves the plan-view flags a new or reactivated link may carry, counting only coach roles that
    /// are not removed. Returns false when the scope covers only a removed role, or when no scope is
    /// given and every held coach role is removed.
    /// </summary>
    /// <param name="scope">The requested scope, or null for the implicit default.</param>
    /// <param name="heldRoles">Identity roles of the professional.</param>
    /// <param name="profile">The professional's profile, or null.</param>
    /// <param name="canViewNutritionPlans">Nutrition flag for the link.</param>
    /// <param name="canViewTrainingPlans">Training flag for the link.</param>
    public static bool TryResolveLinkGrant(
        LinkCapabilityScope? scope,
        IEnumerable<string> heldRoles,
        ProfessionalProfile? profile,
        out bool canViewNutritionPlans,
        out bool canViewTrainingPlans)
    {
        var held = heldRoles.ToList();
        var active = ActiveRoles(held, profile);

        canViewNutritionPlans = scope switch
        {
            LinkCapabilityScope.NutritionOnly => true,
            LinkCapabilityScope.TrainingOnly => false,
            _ => active.Contains(AppRoles.Nutritionist),
        };
        canViewTrainingPlans = scope switch
        {
            LinkCapabilityScope.TrainingOnly => true,
            LinkCapabilityScope.NutritionOnly => false,
            _ => active.Contains(AppRoles.Trainer),
        };

        return scope switch
        {
            LinkCapabilityScope.NutritionOnly => !IsRemoved(profile, AppRoles.Nutritionist),
            LinkCapabilityScope.TrainingOnly => !IsRemoved(profile, AppRoles.Trainer),
            _ => active.Count > 0 || !held.Any(role => role is AppRoles.Trainer or AppRoles.Nutritionist),
        };
    }

    /// <summary>
    /// True when <paramref name="role"/> carries a removal marker on the profile.
    /// </summary>
    /// <param name="profile">The professional profile, or null.</param>
    /// <param name="role">Trainer or Nutritionist.</param>
    public static bool IsRemoved(ProfessionalProfile? profile, string role) => role switch
    {
        AppRoles.Trainer => profile?.TrainerRoleRemovedAt is not null,
        AppRoles.Nutritionist => profile?.NutritionistRoleRemovedAt is not null,
        _ => false,
    };

    /// <summary>
    /// Sets or clears the removal marker for <paramref name="role"/>.
    /// </summary>
    /// <param name="profile">The tracked professional profile.</param>
    /// <param name="role">Trainer or Nutritionist.</param>
    /// <param name="removedAt">The removal time, or null to restore the role.</param>
    public static void SetRemovedAt(ProfessionalProfile profile, string role, DateTime? removedAt)
    {
        switch (role)
        {
            case AppRoles.Trainer:
                profile.TrainerRoleRemovedAt = removedAt;
                break;
            case AppRoles.Nutritionist:
                profile.NutritionistRoleRemovedAt = removedAt;
                break;
        }
    }
}
