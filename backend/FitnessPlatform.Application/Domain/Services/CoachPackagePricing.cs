using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Resolves coach package prices: the price for a billing period from the price history, the per-currency
/// price limits, and the "from" price shown on a coach's public profile.
/// </summary>
public static class CoachPackagePricing
{
    /// <summary>
    /// The largest price a package or a fixed discount can carry in a currency.
    /// </summary>
    /// <param name="currency">The currency.</param>
    public static decimal MaxPrice(PaymentCurrency currency) =>
        currency == PaymentCurrency.EUR ? 50_000m : 1_000_000m;

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
    /// includes payments. Only packages in the coach's main currency count, so prices in two currencies are
    /// never compared; a coach without a settings row has CZK. Coaches with no qualifying package or without
    /// the payments feature are absent.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="entitlementService">Resolves subscription entitlements.</param>
    /// <param name="professionalProfileIds">The coaches to look up.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<Dictionary<long, (decimal Price, PaymentCurrency Currency)>> LoadFromMonthlyPricesAsync(
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

        var rows = await (
            from package in db.CoachPackages.AsNoTracking()
            where entitledIds.Contains(package.ProfessionalProfileId)
                && package.ArchivedAt == null
                && package.ShowOnProfile
                && package.Billing == PackageBillingInterval.Monthly
            join settings in db.CoachPaymentSettings.AsNoTracking()
                on package.ProfessionalProfileId equals settings.ProfessionalProfileId into settingsRows
            from settings in settingsRows.DefaultIfEmpty()
            where package.Currency == (settings == null ? PaymentCurrency.CZK : settings.ProfileCurrency)
            select new { package.ProfessionalProfileId, package.Price, package.Currency })
            .ToListAsync(ct);

        return rows
            .GroupBy(row => row.ProfessionalProfileId)
            .ToDictionary(
                group => group.Key,
                group => (group.Min(row => row.Price), group.First().Currency));
    }
}
