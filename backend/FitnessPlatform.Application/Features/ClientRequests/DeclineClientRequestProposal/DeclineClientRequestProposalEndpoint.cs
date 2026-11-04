using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientRequests.DeclineClientRequestProposal;

/// <summary>
/// A client declines the package a coach proposed on their request. The request ends, but the conversation stays
/// open: the two can agree in chat and either side can send a new invite or request.
/// </summary>
public class DeclineClientRequestProposalEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    IConversationSeedService conversationSeedService,
    TimeProvider timeProvider,
    ILogger<DeclineClientRequestProposalEndpoint> logger)
    : Endpoint<DeclineClientRequestProposalRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/requests/{PublicId}/decline-proposal");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Decline a package proposal";
            s.Description = "Ends the request as ProposalDeclined and tells the coach. The conversation is not archived.";
            s.Responses[StatusCodes.Status204NoContent] = "Proposal declined";
            s.Responses[StatusCodes.Status404NotFound] = "The request is unknown or not the caller's (CLIENT_REQUEST_NOT_FOUND)";
            s.Responses[StatusCodes.Status409Conflict] = "The request has no open proposal (CLIENT_REQUEST_INVALID_STATE)";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeclineClientRequestProposalRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var clientRequest = await db.ClientRequests
            .Include(r => r.ClientProfile)
                .ThenInclude(cp => cp.User)
            .Include(r => r.ProfessionalProfile)
            .FirstOrDefaultAsync(r => r.PublicId == req.PublicId && r.ClientProfile.UserId == userGuid, ct);

        if (clientRequest is null)
        {
            await this.SendProblemAsync(StatusCodes.Status404NotFound, ErrorCodes.ClientRequestNotFound, "Client request not found.", ct);
            return;
        }

        // The coach's withdrawal takes the same row lock, so a withdrawal and a decline cannot both win.
        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockClientProfileAsync(clientRequest.ClientProfileId, ct);

        var currentStatus = await db.ClientRequests
            .AsNoTracking()
            .Where(r => r.Id == clientRequest.Id)
            .Select(r => r.Status)
            .FirstAsync(ct);

        if (currentStatus != ClientRequestStatus.PackageProposed)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.ClientRequestInvalidState,
                "The request has no open package proposal.",
                ct);
            return;
        }

        clientRequest.Status = ClientRequestStatus.ProposalDeclined;
        clientRequest.RespondedAt = timeProvider.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var clientName = $"{clientRequest.ClientProfile.User.FirstName} {clientRequest.ClientProfile.User.LastName}";

        await notificationService.CreateAsync(
            clientRequest.ProfessionalProfile.UserId,
            NotificationType.ClientRequestProposalDeclined,
            new Dictionary<string, string>
            {
                ["clientName"] = clientName,
                ["requestId"] = clientRequest.PublicId.ToString(),
            },
            ct: ct);

        await notifier.NotifyAsync(clientRequest.ProfessionalProfile.UserId, "clientrequestproposaldeclined", new
        {
            RequestPublicId = clientRequest.PublicId,
            ClientPublicId = clientRequest.ClientProfile.PublicId,
            ClientName = clientName,
        }, ct);

        // The client's own Declined event, written only into a thread that already exists. The conversation is never
        // archived here, so the coach can still write to the client.
        await conversationSeedService.AppendCooperationEventAsync(
            clientRequest.ProfessionalProfile.UserId,
            userGuid,
            userGuid,
            ChatEventType.Declined,
            clientRequest.PublicId,
            messageText: null,
            createConversationIfMissing: false,
            ct);

        logger.LogInformation(
            "Package proposal on client request {RequestId} declined by client {ClientId}",
            clientRequest.PublicId, clientRequest.ClientProfile.PublicId);

        await Send.NoContentAsync(ct);
    }
}
