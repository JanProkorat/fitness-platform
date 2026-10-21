using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
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
    /// <param name="appliesToAllPackages">Whether the discount applies to every package; then no packages are loaded.</param>
    /// <param name="packageIds">Requested package public ids.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<List<CoachPackage>?> LoadActivePackagesOrRespondAsync(
        this IEndpoint endpoint,
        IApplicationDbContext db,
        long profileId,
        bool appliesToAllPackages,
        IEnumerable<Guid> packageIds,
        CancellationToken ct)
    {
        if (appliesToAllPackages)
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
}
