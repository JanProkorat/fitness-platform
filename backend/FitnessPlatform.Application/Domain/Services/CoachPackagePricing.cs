using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Resolves coach package prices: the price for a billing period from the price history, and the
/// "from" price shown on a coach's public profile.
/// </summary>
public static class CoachPackagePricing
{
    /// <summary>
    /// Picks the price that applies to a billing period: the latest history row whose effective time is at
    /// or before the period start. A period that started before a price change keeps the old price.
    /// </summary>
    /// <param name="priceHistory">The package's price history.</param>
    /// <param name="periodStartUtc">When the billing period starts (UTC).</param>
    /// <returns>The price, or null when no history row is effective yet.</returns>
    public static decimal? ResolvePrice(IEnumerable<CoachPackagePrice> priceHistory, DateTime periodStartUtc) =>
        priceHistory
            .Where(p => p.EffectiveFromUtc <= periodStartUtc)
            .OrderByDescending(p => p.EffectiveFromUtc)
            .ThenByDescending(p => p.Id)
            .Select(p => (decimal?)p.Price)
            .FirstOrDefault();

    /// <summary>
    /// Loads the lowest current monthly price shown on each coach's profile, for coaches whose subscription
    /// includes payments. Coaches with no qualifying package or without the payments feature are absent.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="entitlementService">Resolves subscription entitlements.</param>
    /// <param name="professionalProfileIds">The coaches to look up.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<Dictionary<long, decimal>> LoadFromMonthlyPricesAsync(
        IApplicationDbContext db,
        EntitlementService entitlementService,
        IReadOnlyCollection<long> professionalProfileIds,
        CancellationToken ct)
    {
        if (professionalProfileIds.Count == 0)
        {
            return [];
        }

        var entitledIds = await entitlementService.GetPaymentsEntitledProfileIdsAsync(professionalProfileIds, ct);

        if (entitledIds.Count == 0)
        {
            return [];
        }

        var rows = await db.CoachPackages
            .AsNoTracking()
            .Where(p => entitledIds.Contains(p.ProfessionalProfileId)
                && p.ArchivedAt == null
                && p.ShowOnProfile
                && p.Billing == PackageBillingInterval.Monthly)
            .GroupBy(p => p.ProfessionalProfileId)
            .Select(g => new { ProfileId = g.Key, MinPrice = g.Min(p => p.Price) })
            .ToListAsync(ct);

        return rows.ToDictionary(r => r.ProfileId, r => r.MinPrice);
    }
}
