using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Resolves a coach's effective feature entitlements and client-count limit from their
/// <see cref="Entities.CoachSubscription"/> and its linked <see cref="Entities.SubscriptionPlan"/>.
/// </summary>
/// <remarks>
/// A professional with no <see cref="Entities.CoachSubscription"/> row at all is treated as fully
/// entitled — every feature flag resolves true and client count is unlimited — so existing coaches
/// are not locked out before the free-tier model is decided (see #593). A subscription whose status
/// is <see cref="SubscriptionStatus.PastDue"/>, <see cref="SubscriptionStatus.Canceled"/>, or
/// <see cref="SubscriptionStatus.Incomplete"/> locks every feature regardless of the plan's own
/// flags; <see cref="SubscriptionStatus.Trialing"/> and <see cref="SubscriptionStatus.Active"/> read
/// the plan's flags directly.
/// </remarks>
public class EntitlementService(IApplicationDbContext db)
{
    /// <summary>
    /// Resolves the effective entitlements for a professional's subscription.
    /// </summary>
    /// <param name="professionalProfileId">The professional's <c>ProfessionalProfile.Id</c>.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<CoachEntitlements> GetEntitlementsAsync(long professionalProfileId, CancellationToken ct)
    {
        var subscription = await db.CoachSubscriptions
            .AsNoTracking()
            .Where(cs => cs.ProfessionalProfileId == professionalProfileId)
            .Select(cs => new
            {
                cs.Status,
                cs.SubscriptionPlan.CanCreatePlans,
                cs.SubscriptionPlan.CanMessage,
                cs.SubscriptionPlan.CanSendQuestionnaires,
                cs.SubscriptionPlan.CanUseWeeklyCheckIns,
                cs.SubscriptionPlan.CanUsePerClientCheckInConfig,
                cs.SubscriptionPlan.CanUsePayments,
                cs.SubscriptionPlan.MaxActiveClients
            })
            .FirstOrDefaultAsync(ct);

        if (subscription is null)
        {
            return CoachEntitlements.FullyEntitled;
        }

        return subscription.Status switch
        {
            SubscriptionStatus.PastDue or SubscriptionStatus.Canceled or SubscriptionStatus.Incomplete =>
                CoachEntitlements.Locked,
            _ => new CoachEntitlements(
                CanCreatePlans: subscription.CanCreatePlans,
                CanMessage: subscription.CanMessage,
                CanSendQuestionnaires: subscription.CanSendQuestionnaires,
                CanUseWeeklyCheckIns: subscription.CanUseWeeklyCheckIns,
                CanUsePerClientCheckInConfig: subscription.CanUsePerClientCheckInConfig,
                CanUsePayments: subscription.CanUsePayments,
                MaxActiveClients: subscription.MaxActiveClients)
        };
    }

    /// <summary>
    /// Resolves, in one query, which of the given professionals may use the payments feature. Applies the
    /// same rules as <see cref="GetEntitlementsAsync"/>: no subscription row means entitled, a locked status
    /// means not entitled, otherwise the plan's flag decides.
    /// </summary>
    /// <param name="professionalProfileIds">The professionals' <c>ProfessionalProfile.Id</c> values.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<HashSet<long>> GetPaymentsEntitledProfileIdsAsync(
        IReadOnlyCollection<long> professionalProfileIds, CancellationToken ct)
    {
        var subscriptions = await db.CoachSubscriptions
            .AsNoTracking()
            .Where(cs => professionalProfileIds.Contains(cs.ProfessionalProfileId))
            .Select(cs => new
            {
                cs.ProfessionalProfileId,
                cs.Status,
                cs.SubscriptionPlan.CanUsePayments
            })
            .ToListAsync(ct);

        var entitled = professionalProfileIds.ToHashSet();

        foreach (var subscription in subscriptions)
        {
            var locked = subscription.Status is SubscriptionStatus.PastDue
                or SubscriptionStatus.Canceled
                or SubscriptionStatus.Incomplete;

            if (locked || !subscription.CanUsePayments)
            {
                entitled.Remove(subscription.ProfessionalProfileId);
            }
        }

        return entitled;
    }

    /// <summary>
    /// Counts the professional's active clients. Independent of subscription state — this is the
    /// real count regardless of whether the subscription (if any) is in good standing.
    /// </summary>
    /// <param name="professionalProfileId">The professional's <c>ProfessionalProfile.Id</c>.</param>
    /// <param name="ct">Cancellation token.</param>
    public Task<int> GetActiveClientCountAsync(long professionalProfileId, CancellationToken ct) =>
        db.ClientProfessionalLinks
            .AsNoTracking()
            .CountAsync(cpl => cpl.ProfessionalProfileId == professionalProfileId && cpl.IsActive, ct);

    /// <summary>
    /// Whether the professional may take on another active client, given their current
    /// entitlements and active client count.
    /// </summary>
    /// <param name="professionalProfileId">The professional's <c>ProfessionalProfile.Id</c>.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<bool> CanAddClientAsync(long professionalProfileId, CancellationToken ct)
    {
        var entitlements = await GetEntitlementsAsync(professionalProfileId, ct);

        if (entitlements.MaxActiveClients is null)
        {
            return true;
        }

        var activeClientCount = await GetActiveClientCountAsync(professionalProfileId, ct);

        return activeClientCount < entitlements.MaxActiveClients;
    }
}
