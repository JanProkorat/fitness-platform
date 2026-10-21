using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Discounts.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Discounts.ListCoachDiscounts;

/// <summary>
/// Lists the calling coach's discounts.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
internal sealed class ListCoachDiscountsEndpoint(IApplicationDbContext db, EntitlementService entitlementService)
    : Endpoint<ListCoachDiscountsRequest, ListCoachDiscountsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/payments/discounts");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List discounts";
            s.Description = "Returns the calling coach's discounts, active ones first. Archived ones only on request.";
            s.Responses[StatusCodes.Status200OK] = "The coach's discounts";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED)";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ListCoachDiscountsRequest req, CancellationToken ct)
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

        var discounts = await db.CoachDiscounts
            .AsNoTracking()
            .Include(d => d.Packages).ThenInclude(l => l.CoachPackage)
            .Where(d => d.ProfessionalProfileId == profileId && (req.IncludeArchived || d.ArchivedAt == null))
            .OrderBy(d => d.ArchivedAt != null)
            .ThenBy(d => d.Name)
            .ToListAsync(ct);

        await Send.OkAsync(new ListCoachDiscountsResponse
        {
            Items = discounts.Select(CoachDiscountDto.FromEntity).ToList()
        }, ct);
    }
}
