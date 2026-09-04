using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Enforces the one-active-coach-per-profession invariant: per client, at most one
/// active <see cref="ClientProfessionalLink"/> may carry <c>CanViewNutritionPlans</c>,
/// and at most one may carry <c>CanViewTrainingPlans</c>. A single dual-role
/// professional holding both flags on ONE link legitimately occupies both slots — this
/// guard only rejects a DIFFERENT professional claiming a slot another active link
/// already holds.
/// </summary>
/// <remarks>
/// Occupancy is derived from the link's own <c>CanViewNutritionPlans</c> /
/// <c>CanViewTrainingPlans</c> pair — never from <c>ProfessionalRole</c> (a single
/// tie-broken display label that misclassifies dual-role professionals) and never from
/// the professional's global identity roles (which over-claim for a link deliberately
/// scoped NutritionOnly/TrainingOnly). Every call site already computes these two flags
/// as held roles narrowed by the caller-requested scope before reaching this guard —
/// pass those computed values, not the roles themselves.
/// </remarks>
public static class ProfessionSlotGuard
{
    /// <summary>
    /// Whether granting <paramref name="wantsNutritionPlans"/> / <paramref name="wantsTrainingPlans"/>
    /// on a link for <paramref name="professionalProfileId"/> would collide with a
    /// profession slot another active professional already holds for the same client.
    /// The professional's own existing link (same <paramref name="professionalProfileId"/>)
    /// is always excluded, so this correctly allows both a brand-new link and a
    /// reactivation of that professional's own previously-deactivated link.
    /// </summary>
    /// <param name="links">The client-professional links to check against.</param>
    /// <param name="clientProfileId">The client whose profession slots are being checked.</param>
    /// <param name="professionalProfileId">
    /// The professional who would own the resulting link — excluded from the collision
    /// check so their own link (new or reactivated) never blocks itself.
    /// </param>
    /// <param name="wantsNutritionPlans">Whether the resulting link would grant nutrition-plan visibility.</param>
    /// <param name="wantsTrainingPlans">Whether the resulting link would grant training-plan visibility.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<bool> IsSlotTakenByAnotherProfessionalAsync(
        IQueryable<ClientProfessionalLink> links,
        long clientProfileId,
        long professionalProfileId,
        bool wantsNutritionPlans,
        bool wantsTrainingPlans,
        CancellationToken ct)
    {
        if (!wantsNutritionPlans && !wantsTrainingPlans)
        {
            return false;
        }

        return await links.AnyAsync(l =>
            l.ClientProfileId == clientProfileId &&
            l.ProfessionalProfileId != professionalProfileId &&
            l.IsActive &&
            ((wantsNutritionPlans && l.CanViewNutritionPlans) ||
             (wantsTrainingPlans && l.CanViewTrainingPlans)),
            ct);
    }
}
