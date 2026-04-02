using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientRequests.SendClientRequest;

/// <summary>
/// Endpoint for a client to send a request to work with a professional.
/// </summary>
public class SendClientRequestEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    ILogger<SendClientRequestEndpoint> logger)
    : Endpoint<SendClientRequestRequest, SendClientRequestResponse>
{
    public override void Configure()
    {
        Post("/client/requests");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Send a client request";
            s.Description = "Sends a request from a client to a professional to establish a working relationship.";
        });
    }

    public override async Task HandleAsync(SendClientRequestRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientNotFound, "Client profile not found.");
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .Include(pp => pp.User)
            .FirstOrDefaultAsync(pp => pp.PublicId == req.ProfessionalPublicId, ct);

        if (professionalProfile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.ProfessionalNotFound, "Professional not found.");
            return;
        }

        if (!professionalProfile.AcceptNewClients)
        {
            this.ThrowErrorWithCode(ErrorCodes.ProfessionalNotAccepting, "Professional is not accepting new clients.");
            return;
        }

        // Check for existing active link
        var existingLink = await db.ClientProfessionalLinks
            .AnyAsync(l => l.ClientProfileId == clientProfile.Id
                        && l.ProfessionalProfileId == professionalProfile.Id
                        && l.IsActive, ct);

        if (existingLink)
        {
            this.ThrowErrorWithCode(ErrorCodes.AlreadyLinked, "You are already linked with this professional.");
            return;
        }

        // Check for existing pending request
        var existingRequest = await db.ClientRequests
            .AnyAsync(r => r.ClientProfileId == clientProfile.Id
                        && r.ProfessionalProfileId == professionalProfile.Id
                        && r.Status == ClientRequestStatus.Pending, ct);

        if (existingRequest)
        {
            this.ThrowErrorWithCode(ErrorCodes.RequestAlreadyPending, "A pending request already exists for this professional.");
            return;
        }

        var clientRequest = new ClientRequest
        {
            ClientProfileId = clientProfile.Id,
            ProfessionalProfileId = professionalProfile.Id,
            Message = req.Message,
            Status = ClientRequestStatus.Pending,
            SentAt = DateTime.UtcNow
        };

        db.ClientRequests.Add(clientRequest);

        // Get client user for notification
        var clientUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);

        var notification = new Notification
        {
            RecipientUserId = professionalProfile.UserId,
            Type = NotificationType.ClientRequestReceived,
            Title = "New client request",
            Body = $"{clientUser.FirstName} {clientUser.LastName} wants to work with you"
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);

        await notifier.NotifyAsync(professionalProfile.UserId, "clientRequestReceived", new
        {
            RequestPublicId = clientRequest.PublicId,
            ClientFirstName = clientUser.FirstName,
            ClientLastName = clientUser.LastName,
            clientRequest.Message
        }, ct);

        logger.LogInformation(
            "Client request sent from {ClientId} to professional {ProfessionalId}",
            clientProfile.PublicId, professionalProfile.PublicId);

        await Send.CreatedAtAsync<SendClientRequestEndpoint>(null, new SendClientRequestResponse
        {
            PublicId = clientRequest.PublicId,
            ProfessionalPublicId = professionalProfile.PublicId,
            ProfessionalName = $"{professionalProfile.User.FirstName} {professionalProfile.User.LastName}",
            Message = clientRequest.Message,
            Status = clientRequest.Status,
            SentAt = clientRequest.SentAt
        }, cancellation: ct);
    }
}
