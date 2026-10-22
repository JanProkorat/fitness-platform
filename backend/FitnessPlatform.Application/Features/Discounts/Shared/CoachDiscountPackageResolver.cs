using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Discounts.Shared;

/// <summary>
/// Resolves the packages a discount is limited to, shared by the create and update actions.
/// </summary>
internal static class CoachDiscountPackageResolver
{
    /// <summary>
    /// Loads the coach's active packages for the requested public ids. When any id is unknown, foreign or
    /// archived it writes one identical 400 (<see cref="ErrorCodes.DiscountPackageInvalid"/>) so a foreign
    /// package's existence never leaks, and returns null — the caller must return immediately on null.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="db">Application database context.</param>
    /// <param name="profileId">The calling coach's professional profile id.</param>
    /// <param name="scope">Which packages the discount covers; packages are loaded only for selected packages.</param>
    /// <param name="packageIds">Requested package public ids.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<List<CoachPackage>?> LoadActivePackagesOrRespondAsync(
        this IEndpoint endpoint,
        IApplicationDbContext db,
        long profileId,
        DiscountScope scope,
        IEnumerable<Guid> packageIds,
        CancellationToken ct)
    {
        if (scope != DiscountScope.SelectedPackages)
        {
            return [];
        }

        var distinctIds = packageIds.Distinct().ToList();

        var packages = await db.CoachPackages
            .Where(p => p.ProfessionalProfileId == profileId && p.ArchivedAt == null && distinctIds.Contains(p.PublicId))
            .ToListAsync(ct);

        if (packages.Count != distinctIds.Count)
        {
            await endpoint.SendProblemAsync(
                StatusCodes.Status400BadRequest,
                ErrorCodes.DiscountPackageInvalid,
                "One or more packages are not available for a discount.",
                ct);
            return null;
        }

        return packages;
    }

    /// <summary>
    /// Writes a 400 (<see cref="ErrorCodes.CurrencyMismatch"/>) and returns true when a fixed discount is
    /// limited to a package in another currency.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="type">Whether the discount is a percentage or a fixed amount.</param>
    /// <param name="currency">The fixed amount's currency.</param>
    /// <param name="packages">The selected packages.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<bool> RespondIfCurrencyMismatchAsync(
        this IEndpoint endpoint,
        DiscountType type,
        PaymentCurrency? currency,
        IEnumerable<CoachPackage> packages,
        CancellationToken ct)
    {
        if (type != DiscountType.FixedAmount || packages.All(package => package.Currency == currency))
        {
            return false;
        }

        await endpoint.SendProblemAsync(
            StatusCodes.Status400BadRequest,
            ErrorCodes.CurrencyMismatch,
            "A fixed discount can only be limited to packages in its own currency.",
            ct);
        return true;
    }
}
