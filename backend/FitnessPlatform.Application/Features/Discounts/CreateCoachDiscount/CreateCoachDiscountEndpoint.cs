using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Discounts.Shared;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Features.Discounts.CreateCoachDiscount;

/// <summary>
/// Creates a discount owned by the calling coach.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="audit">Audit logging service.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
internal sealed class CreateCoachDiscountEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IAuditService audit)
    : Endpoint<CreateCoachDiscountRequest, CoachDiscountDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/payments/discounts");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create a discount";
            s.Description = "Creates a percentage or fixed-amount discount for all or some of the coach's packages.";
            s.Response<CoachDiscountDto>(StatusCodes.Status201Created, "Created discount");
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body, or a package is not available (DISCOUNT_PACKAGE_INVALID)";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED), or the coach role was removed";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateCoachDiscountRequest req, CancellationToken ct)
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

        var packages = await this.LoadActivePackagesOrRespondAsync(
            db, profileId.Value, req.AppliesToAllPackages, req.PackageIds, ct);

        if (packages is null)
        {
            return;
        }

        var discount = new CoachDiscount
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = profileId.Value,
            Name = req.Name.Trim(),
            Type = req.Type,
            Value = req.Value,
            Duration = req.Duration,
            DurationPayments = req.DurationPayments,
            ValidFrom = req.ValidFrom,
            ValidTo = req.ValidTo,
            AppliesToAllPackages = req.AppliesToAllPackages
        };

        foreach (var package in packages)
        {
            discount.Packages.Add(new CoachDiscountPackage { CoachPackage = package });
        }

        db.CoachDiscounts.Add(discount);
        await db.SaveChangesAsync(ct);

        await audit.LogAsync(
            userId,
            "CreateCoachDiscount",
            nameof(CoachDiscount),
            discount.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: JsonSerializer.Serialize(new { discount.Name, discount.Type, discount.Value }),
            ct: ct);

        await Send.ResponseAsync(CoachDiscountDto.FromEntity(discount), StatusCodes.Status201Created, ct);
    }
}
