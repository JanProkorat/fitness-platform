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
    /// Loads the lowest package price shown on each coach's profile across every billing interval, for
    /// coaches whose subscription includes payments. Only packages in the coach's main currency count, so
    /// prices in two currencies are never compared; a coach without a settings row has CZK. On equal prices
    /// the billing order is Monthly, EveryNWeeks, OneOff, then the lowest package id. Coaches with no
    /// qualifying package or without the payments feature are absent.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="entitlementService">Resolves subscription entitlements.</param>
    /// <param name="professionalProfileIds">The coaches to look up.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<Dictionary<long, FromPrice>> LoadFromPricesAsync(
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
            join settings in db.CoachPaymentSettings.AsNoTracking()
                on package.ProfessionalProfileId equals settings.ProfessionalProfileId into settingsRows
            from settings in settingsRows.DefaultIfEmpty()
            where package.Currency == (settings == null ? PaymentCurrency.CZK : settings.ProfileCurrency)
            select new { package.Id, package.ProfessionalProfileId, package.Price, package.Currency, package.Billing, package.IntervalWeeks })
            .ToListAsync(ct);

        return rows
            .GroupBy(row => row.ProfessionalProfileId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    // PackageBillingInterval values already run Monthly, EveryNWeeks, OneOff.
                    var cheapest = group
                        .OrderBy(row => row.Price)
                        .ThenBy(row => row.Billing)
                        .ThenBy(row => row.Id)
                        .First();

                    return new FromPrice(
                        cheapest.Price,
                        cheapest.Currency,
                        cheapest.Billing,
                        cheapest.Billing == PackageBillingInterval.EveryNWeeks ? cheapest.IntervalWeeks : null);
                });
    }
}
