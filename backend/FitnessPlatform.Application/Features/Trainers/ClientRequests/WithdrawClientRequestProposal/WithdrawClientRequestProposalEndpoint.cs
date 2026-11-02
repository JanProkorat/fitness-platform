using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.WithdrawClientRequestProposal;

/// <summary>
/// A professional takes back a package proposal the client has not answered yet; the request is pending again.
/// </summary>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class WithdrawClientRequestProposalEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    ILogger<WithdrawClientRequestProposalEndpoint> logger)
    : Endpoint<WithdrawClientRequestProposalRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/client-requests/{PublicId}/withdraw-proposal");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Withdraw a package proposal";
            s.Description = "Returns a request with an unanswered package proposal to Pending, drops the proposal and tells the client.";
            s.Responses[StatusCodes.Status204NoContent] = "Proposal withdrawn";
            s.Responses[StatusCodes.Status403Forbidden] = "The coach role was removed";
            s.Responses[StatusCodes.Status404NotFound] = "The request is unknown or not the caller's (CLIENT_REQUEST_NOT_FOUND)";
            s.Responses[StatusCodes.Status409Conflict] = "The request has no open proposal (CLIENT_REQUEST_INVALID_STATE)";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(WithdrawClientRequestProposalRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

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
            .FirstOrDefaultAsync(r => r.PublicId == req.PublicId && r.ProfessionalProfileId == professionalProfile.Id, ct);

        if (clientRequest is null)
        {
            await this.SendProblemAsync(StatusCodes.Status404NotFound, ErrorCodes.ClientRequestNotFound, "Client request not found.", ct);
            return;
        }

        // The client's own answer takes the same row lock, so a withdrawal and an acceptance cannot both win.
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

        clientRequest.Status = ClientRequestStatus.Pending;
        clientRequest.ProposedPackageId = null;
        clientRequest.ProposedDiscountId = null;
        clientRequest.ProposedAt = null;
        clientRequest.QuestionnaireId = null;
        clientRequest.Statement = null;

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var profUser = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userGuid, ct);
        var profName = $"{profUser.FirstName} {profUser.LastName}";

        await notificationService.CreateAsync(
            clientRequest.ClientProfile.UserId,
            NotificationType.ClientRequestProposalWithdrawn,
            new Dictionary<string, string>
            {
                ["profName"] = profName,
                ["requestId"] = clientRequest.PublicId.ToString(),
            },
            ct: ct);

        await notifier.NotifyAsync(clientRequest.ClientProfile.UserId, "clientrequestproposalwithdrawn", new
        {
            RequestPublicId = clientRequest.PublicId,
            ProfessionalPublicId = professionalProfile.PublicId,
            ProfessionalName = profName,
        }, ct);

        logger.LogInformation(
            "Package proposal on client request {RequestId} withdrawn by professional {ProfessionalId}",
            clientRequest.PublicId, professionalProfile.PublicId);

        await Send.NoContentAsync(ct);
    }
}
