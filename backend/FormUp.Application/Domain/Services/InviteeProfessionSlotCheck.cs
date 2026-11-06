using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// What an invite to one email address would run into: whether the address is a coach account and,
/// per profession, whether another professional already holds the client's slot.
/// </summary>
/// <param name="IsCoachAccount">The address belongs to a Trainer or Nutritionist account (even with Client as a second role).</param>
/// <param name="ClientProfileId">The invitee's client profile id, or 0 when there is none or the account is a coach account.</param>
/// <param name="NutritionTaken">Another professional holds the nutrition slot, and the caller asked about it.</param>
/// <param name="TrainingTaken">Another professional holds the training slot, and the caller asked about it.</param>
public readonly record struct InviteeSlotCheckResult(
    bool IsCoachAccount,
    long ClientProfileId,
    bool NutritionTaken,
    bool TrainingTaken)
{
    /// <summary>Whether either asked-about slot is taken.</summary>
    public bool AnySlotTaken => NutritionTaken || TrainingTaken;
}

/// <summary>
/// Single place that looks up an invitee by email and decides which profession slots another
/// professional already occupies. Used by the invite-creation backstop and by the live slot check,
/// so the two cannot drift. A coach-account invitee never reports a taken slot: such an invite is
/// stored silently, and a slot answer would reveal that the address is a coach account.
/// </summary>
public static class InviteeProfessionSlotCheck
{
    /// <summary>
    /// Looks up the invitee and checks the requested profession slots against their active links.
    /// </summary>
    /// <param name="db">Database context.</param>
    /// <param name="userManager">Identity user manager, for the invitee's roles.</param>
    /// <param name="email">The invitee's email address.</param>
    /// <param name="professionalProfileId">The professional asking; their own link never blocks them.</param>
    /// <param name="wantsNutritionPlans">Whether the nutrition slot is relevant to the caller.</param>
    /// <param name="wantsTrainingPlans">Whether the training slot is relevant to the caller.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<InviteeSlotCheckResult> CheckAsync(
        IApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        string email,
        long professionalProfileId,
        bool wantsNutritionPlans,
        bool wantsTrainingPlans,
        CancellationToken ct)
    {
        var normalizedEmail = email.ToUpperInvariant();
        var invitee = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);

        if (invitee is null)
        {
            return default;
        }

        var inviteeRoles = await userManager.GetRolesAsync(invitee);

        if (inviteeRoles.Contains(AppRoles.Trainer) || inviteeRoles.Contains(AppRoles.Nutritionist))
        {
            return new InviteeSlotCheckResult(true, 0, false, false);
        }

        var clientProfileId = await db.ClientProfiles
            .AsNoTracking()
            .Where(cp => cp.UserId == invitee.Id)
            .Select(cp => cp.Id)
            .FirstOrDefaultAsync(ct);

        if (clientProfileId == 0)
        {
            return default;
        }

        var nutritionTaken = wantsNutritionPlans
            && await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
                db.ClientProfessionalLinks, clientProfileId, professionalProfileId, true, false, ct);

        var trainingTaken = wantsTrainingPlans
            && await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
                db.ClientProfessionalLinks, clientProfileId, professionalProfileId, false, true, ct);

        return new InviteeSlotCheckResult(false, clientProfileId, nutritionTaken, trainingTaken);
    }
}
