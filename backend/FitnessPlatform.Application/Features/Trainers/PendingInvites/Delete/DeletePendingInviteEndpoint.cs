using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Delete;

/// <summary>
/// Endpoint for cancelling a pending invitation. The row is kept with a Cancelled status so
/// chat cards that reference it still resolve. Only the professional who created it can cancel.
/// </summary>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class DeletePendingInviteEndpoint(
    IApplicationDbContext db,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    IConversationSeedService conversationSeedService) : Endpoint<DeletePendingInviteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/trainer/pending-invites/{Id}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Cancel a pending invitation";
            s.Description = "Cancels a pending invitation. Only the professional who created it can cancel, and only while it is pending.";
            s.Responses[StatusCodes.Status204NoContent] = "Invitation cancelled";
            s.Responses[StatusCodes.Status409Conflict] = "Invitation is not pending";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeletePendingInviteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            ThrowError("Professional profile not found.");
            return;
        }

        if (!Guid.TryParse(req.Id, out var publicId))
        {
            ThrowError("Invalid invitation identifier.");
            return;
        }

        var pendingInvite = await db.PendingInvites
            .FirstOrDefaultAsync(pi => pi.PublicId == publicId, ct);

        if (pendingInvite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (pendingInvite.ProfessionalProfileId != professionalProfile.Id)
        {
            ThrowError("You can only delete your own pending invitations.");
            return;
        }

        // Only an unanswered invite can be cancelled; an answered one keeps its status.
        if (pendingInvite.Status != PendingInviteStatus.Pending)
        {
            await this.SendProblemAsync(StatusCodes.Status409Conflict, ErrorCodes.PendingInviteNotCancellable,
                "Only a pending invitation can be cancelled.", ct);
            return;
        }

        // Look up the invited client by email to send notification
        var invitedUser = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == pendingInvite.Email, ct);

        // An invite addressed to a coaching account is a silent row: withdrawing it must not
        // notify, message or otherwise touch that account, so treat it like an unknown email.
        if (invitedUser is not null &&
            await db.ProfessionalProfiles.AsNoTracking().AnyAsync(pp => pp.UserId == invitedUser.Id, ct))
        {
            invitedUser = null;
        }

        // Invalidate any still-usable token for this invite — otherwise the invitee's email
        // link (AcceptInvitationEndpoint) still works after the coach withdraws in-app, and
        // the thread would read "withdrawn" then "accepted" for an invite that no longer
        // exists. Mirrors AcceptClientInviteEndpoint's matching-tokens marking.
        var matchingTokens = await db.InvitationTokens
            .Where(t => t.ProfessionalProfileId == pendingInvite.ProfessionalProfileId
                        && t.Email == pendingInvite.Email
                        && !t.IsUsed)
            .ToListAsync(ct);

        foreach (var token in matchingTokens)
        {
            token.IsUsed = true;
        }

        // A neutral Withdrawn event only into a conversation that already exists —
        // withdrawing an invite that never got a thread (unverified/no account) must never
        // create one just to announce there is nothing to see.
        if (invitedUser is not null)
        {
            await conversationSeedService.AppendCooperationEventAsync(
                professionalProfile.UserId, invitedUser.Id, professionalProfile.UserId,
                ChatEventType.Withdrawn, pendingInvite.PublicId, messageText: null,
                createConversationIfMissing: false, ct);
        }

        pendingInvite.Status = PendingInviteStatus.Cancelled;
        await db.SaveChangesAsync(ct);

        if (invitedUser is not null)
        {
            var profUser = await db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == professionalProfile.UserId, ct);
            var trainerName = profUser is not null
                ? $"{profUser.FirstName} {profUser.LastName}"
                : "Your trainer";

            await notificationService.CreateAsync(
                invitedUser.Id,
                NotificationType.InvitationCancelled,
                new Dictionary<string, string> { ["trainerName"] = trainerName },
                variant: NotificationTemplates.InvitationCancelledByProfessional,
                ct: ct);

            await notifier.NotifyAsync(invitedUser.Id, "invitationcancelled", new
            {
                InviteId = pendingInvite.PublicId,
            }, ct);
        }

        await Send.NoContentAsync(ct);
    }
}
