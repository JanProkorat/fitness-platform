using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Verifies professional ↔ client relationships and plan view permissions.
/// Cross-database: reads PostgreSQL (professional/client profiles, links) to authorize MongoDB plan access.
/// </summary>
/// <remarks>
/// Every method here is an <see cref="ObsoleteAttribute"/> thin delegating wrapper over
/// <see cref="ClientLinkAuthorizationService"/> (#958) — the consolidated entry point the rest of
/// the epic migrates call sites onto. Each wrapper keeps the exact domain gate it had before the
/// extraction; see the individual method remarks for which capability flag it reads.
/// </remarks>
public class ProfessionalAuthHelper(IApplicationDbContext db)
{
    private readonly ClientLinkAuthorizationService _service = new(db);

    /// <summary>
    /// Verifies that the professional (by ApplicationUser.Id) has an active link to the client (by ClientProfile.PublicId).
    /// </summary>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link exists.</returns>
    /// <remarks>
    /// Despite the name, this gates on <c>CanViewTrainingPlans</c>, not mere link presence — see
    /// <see cref="NutritionAuthHelper.HasActiveLinkAsync"/> for the mirror nutrition gate.
    /// </remarks>
    [Obsolete("Use ClientLinkAuthorizationService.GetCapabilitiesByClientPublicIdAsync and read CanViewTrainingPlans off the result.")]
    public virtual async Task<bool> HasActiveLinkAsync(Guid professionalUserId, Guid clientPublicId, CancellationToken ct)
    {
        var capabilities = await _service.GetCapabilitiesByClientPublicIdAsync(professionalUserId, clientPublicId, ct);
        return capabilities?.CanViewTrainingPlans ?? false;
    }

    /// <summary>
    /// Verifies that the professional has an active link to the client that grants at least
    /// one plan-view capability (training or nutrition). Intended only for the small,
    /// deliberately dual-readable set of endpoints (e.g. client progress) that both Trainers
    /// and Nutritionists may call — do not use this in place of <see cref="HasActiveLinkAsync"/>
    /// or <see cref="HasPlanAccessAsync"/> for single-role-scoped operations.
    /// </summary>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link exists with at least one capability flag granted.</returns>
    [Obsolete("Use ClientLinkAuthorizationService.GetCapabilitiesByClientPublicIdAsync and check !GrantsNothing.")]
    public virtual async Task<bool> HasAnyPlanAccessAsync(Guid professionalUserId, Guid clientPublicId, CancellationToken ct)
    {
        var capabilities = await _service.GetCapabilitiesByClientPublicIdAsync(professionalUserId, clientPublicId, ct);
        return capabilities is { } c && !c.GrantsNothing;
    }

    /// <summary>
    /// Verifies that the professional has an active link with the specific plan view permission
    /// to the client identified by their <c>ApplicationUser.Id</c> — the storage key every Mongo
    /// plan document's <c>ClientId</c> carries since #840.
    /// </summary>
    /// <remarks>
    /// This is the plan-addressed counterpart of <see cref="HasPlanAccessAsync"/>. Plan routes
    /// are addressed by plan id, not client id, so the only client identifier they hold is the
    /// document's <c>ClientId</c>; keying on it directly removes the
    /// <c>ApplicationUser.Id → ClientProfile.PublicId</c> round-trip each call site would
    /// otherwise hand-roll before it could ask the question.
    ///
    /// <para>
    /// Authorship (<c>plan.NutritionistId</c> / <c>plan.TrainerId</c>) is permanent; the link is
    /// not. Every plan-addressed route therefore confirms authorship AND calls this before it
    /// emits or mutates anything, so ending a collaboration ends access.
    /// </para>
    /// </remarks>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientUserId">The client's ApplicationUser.Id, as stored on the plan document.</param>
    /// <param name="requireTrainingPlanAccess">If true, checks CanViewTrainingPlans; if false, checks CanViewNutritionPlans.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link with the required permission exists.</returns>
    [Obsolete("Use ClientLinkAuthorizationService.GetCapabilitiesByClientUserIdAsync and read the appropriate capability flag.")]
    public virtual async Task<bool> HasPlanAccessForClientUserAsync(
        Guid professionalUserId,
        Guid clientUserId,
        bool requireTrainingPlanAccess,
        CancellationToken ct)
    {
        var capabilities = await _service.GetCapabilitiesByClientUserIdAsync(professionalUserId, clientUserId, ct);
        return capabilities is { } c && (requireTrainingPlanAccess ? c.CanViewTrainingPlans : c.CanViewNutritionPlans);
    }

    /// <summary>
    /// Returns the <c>ApplicationUser.Id</c> of every client the professional currently has an
    /// active link to that grants the requested domain capability. Used by the plan LIST routes,
    /// which are not addressed by a single plan and so cannot gate per document — they scope the
    /// query itself to the caller's live link set instead.
    /// </summary>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="requireTrainingPlanAccess">If true, requires CanViewTrainingPlans; if false, CanViewNutritionPlans.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The accessible clients' ApplicationUser.Ids; empty when none.</returns>
    [Obsolete("Use ClientLinkAuthorizationService.GetAccessibleClientsAsync.")]
    public virtual async Task<IReadOnlyList<Guid>> GetAccessibleClientUserIdsAsync(
        Guid professionalUserId,
        bool requireTrainingPlanAccess,
        CancellationToken ct)
    {
        var accessibleClients = await _service.GetAccessibleClientsAsync(professionalUserId, ct, requireTrainingPlanAccess);
        return accessibleClients.Select(client => client.ClientUserId).ToList();
    }

    /// <summary>
    /// Verifies that the professional has an active link with the specific plan view permission.
    /// </summary>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="requireTrainingPlanAccess">If true, checks CanViewTrainingPlans; if false, checks CanViewNutritionPlans.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if an active link with the required permission exists.</returns>
    [Obsolete("Use ClientLinkAuthorizationService.GetCapabilitiesByClientPublicIdAsync and read the appropriate capability flag.")]
    public virtual async Task<bool> HasPlanAccessAsync(Guid professionalUserId, Guid clientPublicId, bool requireTrainingPlanAccess, CancellationToken ct)
    {
        var capabilities = await _service.GetCapabilitiesByClientPublicIdAsync(professionalUserId, clientPublicId, ct);
        return capabilities is { } c && (requireTrainingPlanAccess ? c.CanViewTrainingPlans : c.CanViewNutritionPlans);
    }

    /// <summary>
    /// Loads the capabilities the caller's active link to this client grants, or <c>null</c> when
    /// there is no active link (or no profile on either side). Returns the flags rather than a
    /// boolean so a route can shape its <b>response body</b> per domain, not merely decide who may
    /// reach it.
    /// </summary>
    /// <remarks>
    /// The boolean helpers above answer "may this caller reach this route". Several client-addressed
    /// routes need the follow-up question — "which halves of this response may they see" — and
    /// answering it from a boolean is what let a training-only professional read a client's calorie
    /// targets and macro averages through routes that had correctly let them in. A caller that
    /// receives a non-null result must still apply the
    /// <see cref="LinkCapabilities.GrantsNothing"/> deny before emitting per-client plan data.
    /// </remarks>
    /// <param name="professionalUserId">The professional's ApplicationUser.Id from JWT.</param>
    /// <param name="clientPublicId">The client's ClientProfile.PublicId from the API request.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The link's capabilities, or <c>null</c> when no active link exists.</returns>
    [Obsolete("Use ClientLinkAuthorizationService.GetCapabilitiesByClientPublicIdAsync directly.")]
    public virtual Task<LinkCapabilities?> GetLinkCapabilitiesAsync(
        Guid professionalUserId,
        Guid clientPublicId,
        CancellationToken ct) =>
        _service.GetCapabilitiesByClientPublicIdAsync(professionalUserId, clientPublicId, ct);
}
