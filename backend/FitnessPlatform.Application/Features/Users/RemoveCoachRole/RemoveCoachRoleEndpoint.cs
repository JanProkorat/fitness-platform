using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Users.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Users.RemoveCoachRole;

/// <summary>
/// Marks one of the caller's coach roles as removed. The Identity role and link flags are untouched.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="db">Database context.</param>
/// <param name="coachRoleStatus">Resolves which coach roles are active.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
/// <param name="notificationService">Persisted-notification service.</param>
/// <param name="notifier">Realtime notifier.</param>
/// <param name="logger">Logger.</param>
internal sealed class RemoveCoachRoleEndpoint(
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext db,
    ICoachRoleStatus coachRoleStatus,
    IAuditService audit,
    TimeProvider timeProvider,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    ILogger<RemoveCoachRoleEndpoint> logger) : Endpoint<RemoveCoachRoleRequest, RemoveCoachRoleResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/users/me/roles/{Role}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Remove a coach role";
            s.Description = "Marks the Trainer or Nutritionist role as removed. Rejected when it is the caller's only active coach role.";
            s.Responses[StatusCodes.Status200OK] = "Role removed; counts as they stood before the removal";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid role, ROLE_NOT_ASSIGNED, or ONLY_COACH_ROLE";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RemoveCoachRoleRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Handler-level mirror of the validator allow-list (see SelfAssignableRoles).
        if (!SelfAssignableRoles.Contains(req.Role))
        {
            ThrowError(r => r.Role, "Role is not self-managed.", 400);
            return;
        }

        var role = req.Role.Equals(AppRoles.Trainer, StringComparison.OrdinalIgnoreCase)
            ? AppRoles.Trainer
            : AppRoles.Nutritionist;

        var user = await userManager.FindByIdAsync(userId.ToString());
        var profile = await db.ProfessionalProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (user is null || profile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.RoleNotAssigned, "You do not hold this role.");
            return;
        }

        var activeRoles = await coachRoleStatus.GetActiveRolesAsync(user, profile, ct);

        if (!activeRoles.Contains(role))
        {
            this.ThrowErrorWithCode(ErrorCodes.RoleNotAssigned, "You do not hold this role.");
            return;
        }

        if (activeRoles.Count == 1)
        {
            this.ThrowErrorWithCode(ErrorCodes.OnlyCoachRole, "This is your only coach role and cannot be removed.");
            return;
        }

        var counts = await CoachRoleCounts.LoadAsync(db, profile.Id, activeRoles, ct);

        CoachRoleStatus.SetRemovedAt(profile, role, timeProvider.GetUtcNow().UtcDateTime);
        await db.SaveChangesAsync(ct);

        await NotifyAffectedClientsAsync(user, profile.Id, role, ct);

        await audit.LogAsync(
            userId,
            "RemoveCoachRole",
            nameof(ApplicationUser),
            userId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: $"{{\"removedRole\":\"{role}\"}}",
            ct: ct);

        await Send.OkAsync(new RemoveCoachRoleResponse { RemovedRole = role, Roles = counts }, ct);
    }

    /// <summary>
    /// Tells every client whose active link grants the removed discipline. Best-effort: the removal
    /// is already saved, so a failure is logged and never reaches the caller.
    /// </summary>
    private async Task NotifyAffectedClientsAsync(
        ApplicationUser coach, long professionalProfileId, string role, CancellationToken ct)
    {
        List<Guid> clientUserIds;

        try
        {
            clientUserIds = await db.ClientProfessionalLinks
                .AsNoTracking()
                .Where(l => l.ProfessionalProfileId == professionalProfileId
                            && l.IsActive
                            && (role == AppRoles.Trainer ? l.CanViewTrainingPlans : l.CanViewNutritionPlans))
                .Select(l => l.ClientProfile.UserId)
                .ToListAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "RemoveCoachRole: failed to load clients to notify for coach {CoachUserId}.", coach.Id);
            return;
        }

        var parameters = new Dictionary<string, string> { ["coachName"] = $"{coach.FirstName} {coach.LastName}" };

        foreach (var clientUserId in clientUserIds)
        {
            try
            {
                var notification = await notificationService.CreateAsync(
                    clientUserId, NotificationType.CoachRoleRemoved, parameters, ct: ct);

                await notifier.NotifyAsync(
                    clientUserId,
                    "newnotification",
                    new
                    {
                        id = notification.Id,
                        type = NotificationType.CoachRoleRemoved.ToString(),
                        data = notification.Data,
                    },
                    ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex,
                    "RemoveCoachRole: failed to notify client {ClientUserId} about coach {CoachUserId}.",
                    clientUserId, coach.Id);
            }
        }
    }
}
