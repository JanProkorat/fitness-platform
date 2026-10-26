using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.PaymentSettings.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.PaymentSettings.GetPaymentSettings;

/// <summary>
/// Returns the calling coach's payment settings.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
internal sealed class GetPaymentSettingsEndpoint(IApplicationDbContext db, EntitlementService entitlementService)
    : EndpointWithoutRequest<PaymentSettingsDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/payments/settings");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get payment settings";
            s.Description = "Returns the coach's bank account and payment request defaults. A coach who has not set anything yet gets the defaults and no IBAN.";
            s.Responses[StatusCodes.Status200OK] = "Payment settings";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED)";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var profileId = await this.LoadEntitledProfileIdOrRespondAsync(db, entitlementService, userId, ct);

        if (profileId is null)
        {
            return;
        }

        var settings = await db.CoachPaymentSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProfessionalProfileId == profileId, ct);

        await Send.OkAsync(PaymentSettingsDto.FromEntity(settings), ct);
    }
}
