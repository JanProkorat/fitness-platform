using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Creates the client-professional link for an accepted invite, or switches an ended one back on.
/// Call it inside the transaction, after the client profile row is locked.
/// </summary>
public static class ClientLinkActivator
{
    /// <summary>Result of <see cref="ActivateAsync"/>; the link is set for Created and Reactivated.</summary>
    /// <param name="Outcome">What happened.</param>
    /// <param name="Link">The created or reactivated link, otherwise null.</param>
    public readonly record struct Result(ClientLinkActivationOutcome Outcome, ClientProfessionalLink? Link)
    {
        /// <summary>True when the link was created or reactivated, so the invite's terms and events apply.</summary>
        public bool Started => Outcome is ClientLinkActivationOutcome.Created or ClientLinkActivationOutcome.Reactivated;
    }

    /// <summary>
    /// Loads the pair's link and creates it, reactivates it, or leaves it alone when already active.
    /// The invite's scope and questionnaire replace whatever an ended link carried.
    /// </summary>
    /// <param name="db">Database context; the new or changed link is tracked, not saved.</param>
    /// <param name="userManager">Resolves the professional's identity roles.</param>
    /// <param name="clientProfileId">The accepting client's profile id.</param>
    /// <param name="professional">The inviting professional's profile.</param>
    /// <param name="requestedScope">Scope stored on the invite, or null for every active role.</param>
    /// <param name="questionnaireId">Questionnaire from the invite; overwrites the old value even when null.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<Result> ActivateAsync(
        IApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        long clientProfileId,
        ProfessionalProfile professional,
        LinkCapabilityScope? requestedScope,
        long? questionnaireId,
        CancellationToken ct)
    {
        var link = await db.ClientProfessionalLinks
            .FirstOrDefaultAsync(l => l.ClientProfileId == clientProfileId
                                      && l.ProfessionalProfileId == professional.Id, ct);

        if (link is { IsActive: true })
        {
            return new Result(ClientLinkActivationOutcome.AlreadyActive, null);
        }

        var professionalUser = await userManager.FindByIdAsync(professional.UserId.ToString());
        var professionalRoles = professionalUser is not null
            ? await userManager.GetRolesAsync(professionalUser)
            : [];

        // Grant view access per role actually held — independent booleans, so a professional
        // holding both Trainer and Nutritionist keeps access to both plan types (#776).
        var activeRoles = CoachRoleStatus.ActiveRoles(professionalRoles, professional);
        var professionalRole = activeRoles.Contains(AppRoles.Nutritionist) ? UserRole.Nutritionist : UserRole.Trainer;

        // A coach role the professional has since removed is read-only: it may not seed a link.
        if (!CoachRoleStatus.TryResolveLinkGrant(
                requestedScope, professionalRoles, professional,
                out var canViewNutritionPlans, out var canViewTrainingPlans))
        {
            return new Result(ClientLinkActivationOutcome.CoachRoleRemoved, null);
        }

        // A client may hold at most one active coach per profession (#980); this covers reactivation too.
        if (await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
                db.ClientProfessionalLinks, clientProfileId, professional.Id,
                canViewNutritionPlans, canViewTrainingPlans, ct))
        {
            return new Result(ClientLinkActivationOutcome.SlotTaken, null);
        }

        if (link is not null)
        {
            link.IsActive = true;
            link.ProfessionalRole = professionalRole;
            link.CanViewNutritionPlans = canViewNutritionPlans;
            link.CanViewTrainingPlans = canViewTrainingPlans;
            link.QuestionnaireId = questionnaireId;

            return new Result(ClientLinkActivationOutcome.Reactivated, link);
        }

        link = new ClientProfessionalLink
        {
            ClientProfileId = clientProfileId,
            ProfessionalProfileId = professional.Id,
            ProfessionalRole = professionalRole,
            IsActive = true,
            CanViewNutritionPlans = canViewNutritionPlans,
            CanViewTrainingPlans = canViewTrainingPlans,
            QuestionnaireId = questionnaireId,
        };
        db.ClientProfessionalLinks.Add(link);

        return new Result(ClientLinkActivationOutcome.Created, link);
    }
}
