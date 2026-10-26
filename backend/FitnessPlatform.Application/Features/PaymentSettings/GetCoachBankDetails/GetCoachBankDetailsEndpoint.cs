using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.PaymentSettings.GetCoachBankDetails;

/// <summary>
/// Returns a coach's bank account to a client with a live link to that coach, or who still owes that coach a payment.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="linkAuthorizationService">Resolves whether the coach has a live link to the client.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
internal sealed class GetCoachBankDetailsEndpoint(
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    EntitlementService entitlementService)
    : Endpoint<GetCoachBankDetailsRequest, GetCoachBankDetailsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/coaches/{CoachId}/bank-account");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get a linked coach's bank account";
            s.Description = "Returns the IBAN and account holder to a client with a live link to the coach, whatever the link's plan capabilities, unless the coach removed every role the link covers. A client whose link ended or whose covered roles were removed still gets them while an Upcoming or Requested payment to this coach is open.";
            s.Responses[StatusCodes.Status200OK] = "The coach's bank details";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "No such coach, no live link and nothing owed to the coach, no bank account set, or the coach's subscription does not include payments";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetCoachBankDetailsRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var clientUserId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var coach = await db.ProfessionalProfiles
            .AsNoTracking()
            .Where(p => p.PublicId == req.CoachId)
            .FirstOrDefaultAsync(ct);

        // Every denial is the same bare 404, so a client cannot tell a missing coach from an unlinked one.
        if (coach is null || !(await entitlementService.GetEntitlementsAsync(coach.Id, ct)).CanUsePayments)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(coach.UserId, clientUserId, ct);
        var rolesRemoved = capabilities is { } link
            && (link.CanViewTrainingPlans || link.CanViewNutritionPlans)
            && (!link.CanViewTrainingPlans || CoachRoleStatus.IsRemoved(coach, AppRoles.Trainer))
            && (!link.CanViewNutritionPlans || CoachRoleStatus.IsRemoved(coach, AppRoles.Nutritionist));

        if ((capabilities is null || rolesRemoved) && !await OwesCoachAsync(coach.Id, clientUserId, ct))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var settings = await db.CoachPaymentSettings
            .AsNoTracking()
            .Where(s => s.ProfessionalProfileId == coach.Id && s.Iban != null && s.AccountHolder != null)
            .Select(s => new GetCoachBankDetailsResponse
            {
                Iban = s.Iban!,
                AccountHolder = s.AccountHolder!,
                PaymentDueDays = s.PaymentDueDays
            })
            .FirstOrDefaultAsync(ct);

        if (settings is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(settings, ct);
    }

    private Task<bool> OwesCoachAsync(long coachProfileId, Guid clientUserId, CancellationToken ct) =>
        db.ClientPayments
            .AsNoTracking()
            .AnyAsync(
                p => p.ProfessionalProfileId == coachProfileId
                     && (p.Status == ClientPaymentStatus.Upcoming || p.Status == ClientPaymentStatus.Requested)
                     && db.ClientPaymentAssignments.Any(a => a.Id == p.ClientPaymentAssignmentId
                         && a.ClientProfile.UserId == clientUserId),
                ct);
}
