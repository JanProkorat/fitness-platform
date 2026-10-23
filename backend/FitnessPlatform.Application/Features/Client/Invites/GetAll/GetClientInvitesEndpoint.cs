using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Client.Invites.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Invites.GetAll;

/// <summary>
/// Returns every pending, unexpired invitation addressed to the authenticated client.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="timeProvider">Clock.</param>
/// <param name="entitlementService">Resolves subscription entitlements for the offered packages.</param>
internal sealed class GetClientInvitesEndpoint(
    IApplicationDbContext db,
    TimeProvider timeProvider,
    EntitlementService entitlementService) : EndpointWithoutRequest<GetClientInvitesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/invites");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "List pending invites";
            s.Description = "Returns all pending, unexpired invitations addressed to the authenticated client, newest first.";
            s.Responses[StatusCodes.Status200OK] = "Pending invitations (empty for a coaching account)";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null || !Guid.TryParse(userId, out var userGuid))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Invites addressed to a coaching account are silent rows; such a caller sees none.
        if (User.IsInRole(AppRoles.Trainer) || User.IsInRole(AppRoles.Nutritionist))
        {
            await Send.OkAsync(new GetClientInvitesResponse(), ct);
            return;
        }

        var caller = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userGuid, ct);

        if (caller is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var normalizedEmail = caller.NormalizedEmail ?? caller.Email?.ToUpper() ?? string.Empty;
        var validSince = PendingInviteStatusResolver.ValidSince(timeProvider.GetUtcNow().UtcDateTime);

        var invites = await db.PendingInvites
            .AsNoTracking()
            .Include(pi => pi.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Where(pi => pi.Email.ToUpper() == normalizedEmail
                         && pi.Status == PendingInviteStatus.Pending
                         && pi.SentAt >= validSince)
            .OrderByDescending(pi => pi.SentAt)
            .ToListAsync(ct);

        // One role lookup for every inviting coach instead of one per invite.
        var coachUserIds = invites.Select(pi => pi.ProfessionalProfile.UserId).Distinct().ToList();
        var heldRows = await (
            from ur in db.UserRoles.AsNoTracking()
            join r in db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where coachUserIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name! })
            .ToListAsync(ct);
        var heldByUser = heldRows
            .GroupBy(h => h.UserId)
            .ToDictionary(g => g.Key, g => g.Select(h => h.RoleName).ToList());

        var packages = await InvitePackageLoader.LoadAsync(
            db, entitlementService, invites, timeProvider.GetUtcNow().UtcDateTime, ct);

        var items = new List<ClientInviteDto>(invites.Count);

        foreach (var invite in invites)
        {
            var prof = invite.ProfessionalProfile;
            var held = heldByUser.GetValueOrDefault(prof.UserId) ?? [];
            var roles = CoachRoleStatus.ActiveRoles(held, prof);
            var labels = new List<string>();

            if (roles.Contains(AppRoles.Trainer)) labels.Add("Trainer");
            if (roles.Contains(AppRoles.Nutritionist)) labels.Add("Nutritionist");

            items.Add(new ClientInviteDto
            {
                Id = invite.PublicId,
                CoachPublicId = prof.PublicId,
                CoachName = $"{prof.User.FirstName} {prof.User.LastName}",
                CoachRole = labels.Count > 0 ? string.Join(" & ", labels) : "Trainer",
                CoachCity = prof.City ?? string.Empty,
                Message = invite.Message,
                SentAt = invite.SentAt,
                ExpiresAt = PendingInviteStatusResolver.ExpiresAt(invite.SentAt),
                Package = packages.GetValueOrDefault(invite.Id)
            });
        }

        await Send.OkAsync(new GetClientInvitesResponse { Items = items }, ct);
    }
}
