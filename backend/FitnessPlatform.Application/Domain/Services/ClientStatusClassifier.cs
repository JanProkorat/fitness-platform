using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Derives a client's Active/Paused/Archived status from the link's liveness and whether an
/// in-window Active plan exists in a domain the caller's link grants. Extracted from
/// <c>GetClientsEndpoint</c> (#1094) so the clients list and the client-detail dashboard compute
/// the exact same status for the same client — a page-side re-derivation on the detail page
/// cannot reproduce this: the plans-list response carries no <c>WeekCount</c>, and a running
/// plan's <c>PeriodEnd</c> is null, so it cannot apply the in-window check itself.
/// </summary>
/// <remarks>
/// Pure — no Mongo, no <c>DbContext</c>. Callers resolve the in-window Active plan lookup
/// themselves (see <see cref="PlanWindowResolver.IsWithinWindow"/>) and pass the result in; this
/// type only combines that result with link liveness and the caller's own
/// <see cref="LinkCapabilities"/>. Capabilities are a mandatory parameter, not
/// optional-with-a-permissive-default: passing the caller's own capabilities is what keeps this
/// derivation capability-scoped — a link that does not grant a domain must never read that
/// domain's plan presence as "active" for status purposes, even if a caller passes an
/// already-unfiltered plan-presence flag for that domain.
/// </remarks>
public static class ClientStatusClassifier
{
    /// <summary>
    /// Classifies a client's status.
    /// </summary>
    /// <param name="isActive">Whether the caller's link to the client is currently live.</param>
    /// <param name="capabilities">
    /// The caller's own link capabilities — gates which domain's plan presence counts toward
    /// Active.
    /// </param>
    /// <param name="hasActiveNutritionPlan">
    /// Whether the client has an in-window Active nutrition plan, already resolved by the caller.
    /// </param>
    /// <param name="hasActiveTrainingPlan">
    /// Whether the client has an in-window Active training plan, already resolved by the caller.
    /// </param>
    public static ClientListStatus Classify(
        bool isActive,
        LinkCapabilities capabilities,
        bool hasActiveNutritionPlan,
        bool hasActiveTrainingPlan)
    {
        if (!isActive)
        {
            return ClientListStatus.Archived;
        }

        var visibleActiveNutritionPlan = capabilities.CanViewNutritionPlans && hasActiveNutritionPlan;
        var visibleActiveTrainingPlan = capabilities.CanViewTrainingPlans && hasActiveTrainingPlan;

        return visibleActiveNutritionPlan || visibleActiveTrainingPlan
            ? ClientListStatus.Active
            : ClientListStatus.Paused;
    }
}
