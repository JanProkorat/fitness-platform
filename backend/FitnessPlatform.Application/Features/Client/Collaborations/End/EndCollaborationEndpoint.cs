using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Collaborations.End;

/// <summary>
/// Deactivates a client-professional link. This is permanent.
/// </summary>
public class EndCollaborationEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Delete("/client/collaborations/{PublicId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "End a collaboration";
            s.Description = "Permanently deactivates a client-professional link.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);
        var publicId = Route<Guid>("PublicId");

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var link = await db.ClientProfessionalLinks
            .Include(l => l.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .FirstOrDefaultAsync(l => l.PublicId == publicId
                                   && l.ClientProfileId == clientProfile.Id
                                   && l.IsActive, ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        link.IsActive = false;
        await db.SaveChangesAsync(ct);

        // Notify the professional
        var clientUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);
        var clientName = $"{clientUser.FirstName} {clientUser.LastName}";
        var profName = $"{link.ProfessionalProfile.User.FirstName} {link.ProfessionalProfile.User.LastName}";

        await notificationService.CreateAsync(
            link.ProfessionalProfile.UserId,
            NotificationType.General,
            new Dictionary<string, string> { ["clientName"] = clientName },
            ct: ct);

        await notifier.NotifyAsync(link.ProfessionalProfile.UserId, "collaborationended", new
        {
            LinkPublicId = link.PublicId,
            ClientName = clientName
        }, ct);

        await Send.NoContentAsync(ct);
    }
}
