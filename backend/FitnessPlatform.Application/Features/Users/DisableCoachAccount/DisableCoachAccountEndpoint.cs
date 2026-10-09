using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Users.DisableCoachAccount;

/// <summary>
/// Disables the caller's coach account: it stays active until the paid period ends, or ends at once
/// when there is no paid period.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="db">Database context.</param>
/// <param name="coachRoleStatus">Resolves which coach roles are active.</param>
/// <param name="coachRoleRemover">Removes the coach roles when the account ends now.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class DisableCoachAccountEndpoint(
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext db,
    ICoachRoleStatus coachRoleStatus,
    ICoachRoleRemover coachRoleRemover,
    IAuditService audit,
    TimeProvider timeProvider) : EndpointWithoutRequest<DisableCoachAccountResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/users/me/coach-account/disable");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Disable my coach account";
            s.Description = "Marks the coach account as not renewing. Roles are removed at the end of the paid period, or at once when there is none. Repeating the call while pending returns the same date.";
            s.Responses[StatusCodes.Status200OK] = "Date the account stops being active and the roles removed by this call";
            s.Responses[StatusCodes.Status400BadRequest] = "NO_ACTIVE_COACH_ROLE";
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

        var user = await userManager.FindByIdAsync(userId.ToString());
        var profile = await db.ProfessionalProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (user is null || profile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.NoActiveCoachRole, "You have no active coach role.");
            return;
        }

        var activeRoles = await coachRoleStatus.GetActiveRolesAsync(user, profile, ct);

        if (activeRoles.Count == 0)
        {
            this.ThrowErrorWithCode(ErrorCodes.NoActiveCoachRole, "You have no active coach role.");
            return;
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;

        if (profile.CoachAccountActiveUntil is { } pendingUntil && pendingUntil > now)
        {
            await Send.OkAsync(new DisableCoachAccountResponse { ActiveUntil = pendingUntil }, ct);
            return;
        }

        var subscription = await db.CoachSubscriptions
            .FirstOrDefaultAsync(cs => cs.ProfessionalProfileId == profile.Id, ct);

        // A date that already passed (the sweeper has not run yet) resolves to now and ends the account.
        var activeUntil = profile.CoachAccountActiveUntil is { } passed
            ? passed
            : CoachAccountActiveUntilResolver.Resolve(subscription, now);

        profile.CoachAccountActiveUntil = activeUntil;

        if (subscription is not null)
        {
            subscription.CancelAtPeriodEnd = true;
        }

        await db.SaveChangesAsync(ct);

        IReadOnlyList<string> rolesRemoved = [];

        if (activeUntil <= now)
        {
            rolesRemoved = await coachRoleRemover.RemoveAsync(user, profile.Id, activeRoles, now, ct);
        }

        await audit.LogAsync(
            userId,
            "DisableCoachAccount",
            nameof(ApplicationUser),
            userId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: $"{{\"activeUntil\":\"{activeUntil:O}\"}}",
            ct: ct);

        await Send.OkAsync(new DisableCoachAccountResponse
        {
            ActiveUntil = activeUntil,
            RolesRemoved = rolesRemoved.ToList(),
        }, ct);
    }
}
