using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.PaymentSettings.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.PaymentSettings.UpdatePaymentSettings;

/// <summary>
/// Updates the calling coach's payment request defaults (due days, message and variable symbol formats).
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Exempt, Reason = "The coach's own payment settings stay editable while no coach role is active.")]
internal sealed class UpdatePaymentSettingsEndpoint(IApplicationDbContext db, EntitlementService entitlementService)
    : Endpoint<UpdatePaymentSettingsRequest, PaymentSettingsDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/payments/settings");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update payment settings";
            s.Description = "Sets the payment due days, the message and variable symbol formats and the main currency (kept when omitted). The bank account is changed through its own endpoint.";
            s.Responses[StatusCodes.Status200OK] = "Updated payment settings";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED)";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdatePaymentSettingsRequest req, CancellationToken ct)
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
            .FirstOrDefaultAsync(s => s.ProfessionalProfileId == profileId, ct);

        if (settings is null)
        {
            settings = new CoachPaymentSettings { ProfessionalProfileId = profileId.Value };
            db.CoachPaymentSettings.Add(settings);
        }

        settings.PaymentDueDays = req.PaymentDueDays;
        settings.MessageFormat = req.MessageFormat;
        settings.VariableSymbolFormat = req.VariableSymbolFormat;
        settings.ProfileCurrency = req.ProfileCurrency ?? settings.ProfileCurrency;

        await db.SaveChangesAsync(ct);

        await Send.OkAsync(PaymentSettingsDto.FromEntity(settings), ct);
    }
}
