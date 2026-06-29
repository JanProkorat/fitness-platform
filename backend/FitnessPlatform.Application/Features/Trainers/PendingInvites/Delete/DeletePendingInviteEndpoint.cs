using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Delete;

/// <summary>
/// Endpoint for deleting a pending invitation.
/// Only the professional who created the invitation can delete it.
/// </summary>
public class DeletePendingInviteEndpoint(
    IApplicationDbContext db,
    INotificationService notificationService,
    IRealtimeNotifier notifier) : Endpoint<DeletePendingInviteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/trainer/pending-invites/{Id}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Delete a pending invitation";
            s.Description = "Deletes a pending invitation. Only the professional who created it can delete.";
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

        // Look up the invited client by email to send notification
        var invitedUser = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == pendingInvite.Email, ct);

        db.PendingInvites.Remove(pendingInvite);
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
                "Invitation cancelled",
                $"{trainerName} has cancelled their invitation.",
                ct: ct);

            await notifier.NotifyAsync(invitedUser.Id, "invitationcancelled", new
            {
                InviteId = pendingInvite.PublicId,
            }, ct);
        }

        await Send.NoContentAsync(ct);
    }
}
