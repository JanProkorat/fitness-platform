using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.RejectClientRequest;

/// <summary>
/// Endpoint for a professional to reject a pending client request.
/// </summary>
public class RejectClientRequestEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    ILogger<RejectClientRequestEndpoint> logger)
    : Endpoint<RejectClientRequestRequest>
{
    public override void Configure()
    {
        Post("/trainer/client-requests/{PublicId}/reject");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Reject a client request";
            s.Description = "Rejects a pending client request.";
        });
    }

    public override async Task HandleAsync(RejectClientRequestRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);
        var publicId = req.PublicId;

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == userGuid, ct);

        if (professionalProfile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.TrainerProfileMissing, "Professional profile not found.");
            return;
        }

        var clientRequest = await db.ClientRequests
            .Include(r => r.ClientProfile)
            .FirstOrDefaultAsync(r => r.PublicId == publicId, ct);

        if (clientRequest is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "Client request not found.");
            return;
        }

        if (clientRequest.ProfessionalProfileId != professionalProfile.Id)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "Client request not found.");
            return;
        }

        if (clientRequest.Status != ClientRequestStatus.Pending)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "This request has already been processed.");
            return;
        }

        clientRequest.Status = ClientRequestStatus.Rejected;
        clientRequest.RespondedAt = DateTime.UtcNow;
        clientRequest.Statement = req.Statement;

        var profUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);
        var profName = $"{profUser.FirstName} {profUser.LastName}";

        // Save entity changes (status update) before creating notification
        await db.SaveChangesAsync(ct);

        await notificationService.CreateAsync(
            clientRequest.ClientProfile.UserId,
            NotificationType.InvitationDeclined,
            "Invitation declined",
            $"{profName} declined your invitation.",
            ct: ct);

        await notifier.NotifyAsync(clientRequest.ClientProfile.UserId, "clientRequestRejected", new
        {
            RequestPublicId = clientRequest.PublicId
        }, ct);

        logger.LogInformation(
            "Client request {RequestId} rejected by professional {ProfessionalId}",
            clientRequest.PublicId, professionalProfile.PublicId);

        await Send.NoContentAsync(ct);
    }
}
