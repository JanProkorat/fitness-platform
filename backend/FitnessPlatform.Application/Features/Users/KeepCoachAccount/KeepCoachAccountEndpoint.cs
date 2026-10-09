using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Authorization;
using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Users.KeepCoachAccount;

/// <summary>
/// Undoes a pending coach-account disable before its end date.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Exempt, Reason = "Account lifecycle action that must stay reachable after every role is removed.")]
internal sealed class KeepCoachAccountEndpoint(
    IApplicationDbContext db,
    IAuditService audit,
    TimeProvider timeProvider) : EndpointWithoutRequest<KeepCoachAccountResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/users/me/coach-account/keep");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Keep my coach account";
            s.Description = "Cancels a pending disable while its end date is still in the future.";
            s.Responses[StatusCodes.Status200OK] = "Pending disable cleared";
            s.Responses[StatusCodes.Status400BadRequest] = "COACH_ACCOUNT_NOT_DISABLING or COACH_ACCOUNT_DISABLE_ENDED";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
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

        var profile = await db.ProfessionalProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (profile?.CoachAccountActiveUntil is not { } activeUntil)
        {
            this.ThrowErrorWithCode(ErrorCodes.CoachAccountNotDisabling, "Your coach account is not being disabled.");
            return;
        }

        if (activeUntil <= timeProvider.GetUtcNow().UtcDateTime)
        {
            this.ThrowErrorWithCode(
                ErrorCodes.CoachAccountDisableEnded, "The disable already took effect; add the role back instead.");
            return;
        }

        profile.CoachAccountActiveUntil = null;

        var subscription = await db.CoachSubscriptions
            .FirstOrDefaultAsync(cs => cs.ProfessionalProfileId == profile.Id, ct);

        if (subscription is not null)
        {
            subscription.CancelAtPeriodEnd = false;
        }

        await db.SaveChangesAsync(ct);

        await audit.LogAsync(
            userId,
            "KeepCoachAccount",
            nameof(ApplicationUser),
            userId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: $"{{\"clearedActiveUntil\":\"{activeUntil:O}\"}}",
            ct: ct);

        await Send.OkAsync(new KeepCoachAccountResponse(), ct);
    }
}
