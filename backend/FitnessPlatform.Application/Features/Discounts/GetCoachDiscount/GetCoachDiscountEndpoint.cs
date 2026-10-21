using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Discounts.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Discounts.GetCoachDiscount;

/// <summary>
/// Returns one of the calling coach's discounts, archived or not.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
internal sealed class GetCoachDiscountEndpoint(IApplicationDbContext db, EntitlementService entitlementService)
    : Endpoint<GetCoachDiscountRequest, CoachDiscountDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/payments/discounts/{DiscountId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a discount";
            s.Description = "Returns one of the calling coach's discounts.";
            s.Responses[StatusCodes.Status200OK] = "The discount";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED)";
            s.Responses[StatusCodes.Status404NotFound] = "The discount does not exist or belongs to another coach, or the caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetCoachDiscountRequest req, CancellationToken ct)
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

        var discount = await db.CoachDiscounts
            .AsNoTracking()
            .Include(d => d.Packages).ThenInclude(l => l.CoachPackage)
            .FirstOrDefaultAsync(d => d.PublicId == req.DiscountId && d.ProfessionalProfileId == profileId, ct);

        if (discount is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(CoachDiscountDto.FromEntity(discount), ct);
    }
}
