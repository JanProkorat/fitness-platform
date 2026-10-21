using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.PaymentSettings.Shared;

/// <summary>
/// The caller-is-a-coach-with-the-payments-feature guard shared by every coach-facing payments action.
/// </summary>
internal static class PaymentSettingsAccess
{
    /// <summary>
    /// Resolves the caller's professional profile id and checks the subscription includes payments.
    /// Writes a 404 (no professional profile) or a coded 403 (not entitled) and returns null when
    /// the caller may not proceed — the caller must return immediately on null.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="db">Application database context.</param>
    /// <param name="entitlementService">Resolves subscription entitlements.</param>
    /// <param name="userId">The caller's ApplicationUser.Id from JWT.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<long?> LoadEntitledProfileIdOrRespondAsync(
        this IEndpoint endpoint,
        IApplicationDbContext db,
        EntitlementService entitlementService,
        Guid userId,
        CancellationToken ct)
    {
        var profileId = await db.ProfessionalProfiles
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => (long?)p.Id)
            .FirstOrDefaultAsync(ct);

        if (profileId is null)
        {
            await endpoint.HttpContext.Response.SendNotFoundAsync(ct);
            return null;
        }

        var entitlements = await entitlementService.GetEntitlementsAsync(profileId.Value, ct);

        if (!entitlements.CanUsePayments)
        {
            await endpoint.SendProblemAsync(
                StatusCodes.Status403Forbidden,
                ErrorCodes.PaymentsNotEntitled,
                "The current subscription does not include payments.",
                ct);
            return null;
        }

        return profileId;
    }
}
