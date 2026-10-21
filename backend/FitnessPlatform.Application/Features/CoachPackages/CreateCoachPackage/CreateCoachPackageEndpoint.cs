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
using FitnessPlatform.Application.Features.CoachPackages.Shared;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Features.CoachPackages.CreateCoachPackage;

/// <summary>
/// Creates a package owned by the calling coach and records its first price.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
internal sealed class CreateCoachPackageEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<CreateCoachPackageRequest, CoachPackageDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/payments/packages");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create a package";
            s.Description = "Creates a paid package (name, price, billing rhythm) owned by the calling coach.";
            s.Response<CoachPackageDto>(StatusCodes.Status201Created, "Created package");
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED), or the coach role was removed";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateCoachPackageRequest req, CancellationToken ct)
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

        var package = new CoachPackage
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = profileId.Value,
            Name = req.Name.Trim(),
            Price = req.Price,
            Billing = req.Billing,
            IntervalWeeks = req.IntervalWeeks,
            RunsForPayments = req.RunsForPayments,
            PaymentDueDaysOverride = req.PaymentDueDaysOverride,
            ShowOnProfile = req.ShowOnProfile
        };

        package.Prices.Add(new CoachPackagePrice
        {
            Price = req.Price,
            EffectiveFromUtc = timeProvider.GetUtcNow().UtcDateTime
        });

        db.CoachPackages.Add(package);
        await db.SaveChangesAsync(ct);

        await audit.LogAsync(
            userId,
            "CreateCoachPackage",
            nameof(CoachPackage),
            package.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: JsonSerializer.Serialize(new { package.Name, package.Price, package.Billing }),
            ct: ct);

        await Send.ResponseAsync(CoachPackageDto.FromEntity(package), StatusCodes.Status201Created, ct);
    }
}
