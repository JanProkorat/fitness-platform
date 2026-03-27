using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Delete;

/// <summary>
/// Endpoint for deleting a pending invitation.
/// Only the professional who created the invitation can delete it.
/// </summary>
/// <param name="db">Database context.</param>
public class DeletePendingInviteEndpoint(IApplicationDbContext db) : Endpoint<DeletePendingInviteRequest>
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

        db.PendingInvites.Remove(pendingInvite);
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
