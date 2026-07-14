using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientRequests.CancelClientRequest;

/// <summary>
/// Endpoint for a client to cancel (revoke) a pending request.
/// </summary>
public class CancelClientRequestEndpoint(IApplicationDbContext db, IRealtimeNotifier notifier, INotificationService notificationService) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Delete("/client/requests/{PublicId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Cancel a client request";
            s.Description = "Cancels a pending client request. Only pending requests can be cancelled.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);
        var publicId = Route<Guid>("PublicId");

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientNotFound, "Client profile not found.");
            return;
        }

        var request = await db.ClientRequests
            .FirstOrDefaultAsync(r => r.PublicId == publicId, ct);

        if (request is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "Request not found.");
            return;
        }

        if (request.ClientProfileId != clientProfile.Id)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "Request not found.");
            return;
        }

        if (request.Status != ClientRequestStatus.Pending)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "Only pending requests can be cancelled.");
            return;
        }

        request.Status = ClientRequestStatus.Cancelled;
        request.RespondedAt = DateTime.UtcNow;

        // Notify the professional that the client revoked the invite
        var profProfile = await db.ProfessionalProfiles
            .Include(pp => pp.User)
            .FirstAsync(pp => pp.Id == request.ProfessionalProfileId, ct);

        var clientUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);
        var clientName = $"{clientUser.FirstName} {clientUser.LastName}";

        // Save entity changes (status update) before creating notification
        await db.SaveChangesAsync(ct);

        await notificationService.CreateAsync(
            profProfile.UserId,
            NotificationType.InvitationCancelled,
            new Dictionary<string, string> { ["clientName"] = clientName },
            variant: NotificationTemplates.InvitationCancelledRevokedByClient,
            ct: ct);

        await notifier.NotifyAsync(profProfile.UserId, "clientrequestcancelled", new
        {
            RequestPublicId = request.PublicId,
            ClientName = clientName
        }, ct);

        await Send.NoContentAsync(ct);
    }
}
