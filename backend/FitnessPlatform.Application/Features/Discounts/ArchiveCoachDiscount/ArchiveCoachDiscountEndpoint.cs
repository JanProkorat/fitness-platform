using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Discounts.ArchiveCoachDiscount;

/// <summary>
/// Archives one of the calling coach's discounts. Archiving an archived discount succeeds without change.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
internal sealed class ArchiveCoachDiscountEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<ArchiveCoachDiscountRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/payments/discounts/{DiscountId}/archive");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Archive a discount";
            s.Description = "Archives a discount so it can no longer be edited or applied. Idempotent.";
            s.Responses[StatusCodes.Status204NoContent] = "Discount archived";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED), or the coach role was removed";
            s.Responses[StatusCodes.Status404NotFound] = "The discount does not exist or belongs to another coach, or the caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ArchiveCoachDiscountRequest req, CancellationToken ct)
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
            .FirstOrDefaultAsync(d => d.PublicId == req.DiscountId && d.ProfessionalProfileId == profileId, ct);

        if (discount is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (discount.ArchivedAt is null)
        {
            discount.ArchivedAt = timeProvider.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);

            await audit.LogAsync(
                userId,
                "ArchiveCoachDiscount",
                nameof(CoachDiscount),
                discount.PublicId,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                ct: ct);
        }

        await Send.NoContentAsync(ct);
    }
}
