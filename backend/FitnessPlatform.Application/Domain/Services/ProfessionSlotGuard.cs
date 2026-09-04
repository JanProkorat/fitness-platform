using FitnessPlatform.Application.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Enforces the one-active-coach-per-profession invariant: per client, at most one
/// active <see cref="ClientProfessionalLink"/> may carry <c>CanViewNutritionPlans</c>,
/// and at most one may carry <c>CanViewTrainingPlans</c>. A single dual-role
/// professional holding both flags on ONE link legitimately occupies both slots — this
/// guard only rejects a DIFFERENT professional claiming a slot another active link
/// already holds. A collaboration is a deliberately exempt, different mechanism (see the
/// two-exclusion overload's remarks below) — not a second independent coach claiming a slot.
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
    /// Single-exclusion overload for the three accept/invite paths, where exactly one
    /// professional (the one whose link is being created or reactivated) needs excluding
    /// from the collision check. See the collection overload for details.
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
    public static Task<bool> IsSlotTakenByAnotherProfessionalAsync(
        IQueryable<ClientProfessionalLink> links,
        long clientProfileId,
        long professionalProfileId,
        bool wantsNutritionPlans,
        bool wantsTrainingPlans,
        CancellationToken ct) =>
        IsSlotTakenByAnotherProfessionalAsync(
            links, clientProfileId, [professionalProfileId], wantsNutritionPlans, wantsTrainingPlans, ct);

    /// <summary>
    /// Whether granting <paramref name="wantsNutritionPlans"/> / <paramref name="wantsTrainingPlans"/>
    /// for this client would collide with a profession slot an active professional
    /// OTHER than one of <paramref name="excludedProfessionalProfileIds"/> already holds.
    /// </summary>
    /// <remarks>
    /// The one-active-coach-per-profession rule governs INDEPENDENT coach links. A
    /// collaboration is a deliberately EXEMPT, different mechanism — a shared/delegated
    /// grant between the caller and a collaborator, not a second coach competing for the
    /// caller's own slot — so CreateCollaborationEndpoint needs TWO exclusions, not one:
    /// the collaborator's flags are clamped to what the caller's own link already grants,
    /// so the caller's link necessarily already carries every flag the collaboration could
    /// grant. Excluding only the collaborator would mean the caller's own pre-existing
    /// occupancy permanently blocks every successful collaboration. Only a genuinely
    /// unrelated THIRD professional (onboarded via one of the other three paths, entirely
    /// outside this collaboration) should trip this guard for CreateCollaboration — do not
    /// "fix" this back to a single exclusion. The three accept/invite paths only ever mint
    /// one link at a time and use the single-exclusion overload above instead.
    /// </remarks>
    public static async Task<bool> IsSlotTakenByAnotherProfessionalAsync(
        IQueryable<ClientProfessionalLink> links,
        long clientProfileId,
        IReadOnlyCollection<long> excludedProfessionalProfileIds,
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
            !excludedProfessionalProfileIds.Contains(l.ProfessionalProfileId) &&
            l.IsActive &&
            ((wantsNutritionPlans && l.CanViewNutritionPlans) ||
             (wantsTrainingPlans && l.CanViewTrainingPlans)),
            ct);
    }
}
