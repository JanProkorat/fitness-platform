using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Invites.Accept;

/// <summary>
/// Client accepts a pending invite by its PublicId. Creates the client-professional link.
/// </summary>
public class AcceptClientInviteEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    IAuditService audit)
    : Endpoint<AcceptClientInviteRequest>
{
    public override void Configure()
    {
        Post("/client/invites/{Id}/accept");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Accept a pending invite";
            s.Description = "Accepts a pending invitation from a professional, creating a client-professional link.";
        });
    }

    public override async Task HandleAsync(AcceptClientInviteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var invite = await db.PendingInvites
            .Include(pi => pi.ProfessionalProfile)
            .FirstOrDefaultAsync(pi => pi.PublicId == req.Id && !pi.IsAccepted, ct);

        if (invite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Ensure or create client profile
        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            clientProfile = new ClientProfile { UserId = userGuid };
            db.ClientProfiles.Add(clientProfile);
            await db.SaveChangesAsync(ct);
        }

        // Check for existing link
        var existingLink = await db.ClientProfessionalLinks
            .AnyAsync(l => l.ClientProfileId == clientProfile.Id
                           && l.ProfessionalProfileId == invite.ProfessionalProfileId, ct);

        if (!existingLink)
        {
            var professionalUser = await userManager.FindByIdAsync(
                invite.ProfessionalProfile.UserId.ToString());
            var profRoles = professionalUser is not null
                ? await userManager.GetRolesAsync(professionalUser)
                : [];
            var profRole = profRoles.Contains(AppRoles.Nutritionist)
                ? UserRole.Nutritionist
                : UserRole.Trainer;

            var link = new ClientProfessionalLink
            {
                ClientProfileId = clientProfile.Id,
                ProfessionalProfileId = invite.ProfessionalProfileId,
                ProfessionalRole = profRole,
                IsActive = true,
                QuestionnaireId = invite.QuestionnaireId
            };
            db.ClientProfessionalLinks.Add(link);
        }

        invite.IsAccepted = true;

        // Also mark matching invitation tokens as used
        var matchingTokens = await db.InvitationTokens
            .Where(t => t.ProfessionalProfileId == invite.ProfessionalProfileId
                        && t.Email == invite.Email
                        && !t.IsUsed)
            .ToListAsync(ct);

        foreach (var token in matchingTokens)
            token.IsUsed = true;

        await db.SaveChangesAsync(ct);

        // Notify the professional that their invite was accepted
        var clientUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);
        var clientName = $"{clientUser.FirstName} {clientUser.LastName}";

        await notificationService.CreateAsync(
            invite.ProfessionalProfile.UserId,
            NotificationType.ClientRequestAccepted,
            "Invitation accepted",
            $"{clientName} accepted your invitation.",
            ct: ct);

        await notifier.NotifyAsync(
            invite.ProfessionalProfile.UserId,
            "inviteAccepted",
            new { clientName, inviteId = invite.PublicId },
            ct);

        await audit.LogAsync(userGuid, "AcceptInviteFromApp", nameof(ClientProfessionalLink),
            invite.ProfessionalProfile.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(), ct: ct);

        await Send.NoContentAsync(ct);
    }
}

public class AcceptClientInviteRequest
{
    public Guid Id { get; set; }
}
