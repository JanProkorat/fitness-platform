using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.CreateCollaboration;

/// <summary>
/// Endpoint for inviting another professional (trainer or nutritionist) to co-manage a client.
/// The requesting trainer must already have an active link to the client.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager for role lookups.</param>
public class CreateCollaborationEndpoint(IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    : Endpoint<CreateCollaborationRequest, CreateCollaborationResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/collaborations");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create collaboration";
            s.Description =
                "Invites another professional (trainer or nutritionist) to co-manage one of the requesting trainer's clients.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateCollaborationRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Find the requesting trainer's profile
        var trainerProfile = await db.TrainerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (trainerProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Find the client by PublicId
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientPublicId, ct);

        if (clientProfile is null)
        {
            ThrowError("Client not found.");
            return;
        }

        // Verify the requesting trainer has an active link to this client
        var hasActiveLink = await db.ClientTrainerLinks
            .AsNoTracking()
            .AnyAsync(ctl =>
                ctl.TrainerProfileId == trainerProfile.Id &&
                ctl.ClientProfileId == clientProfile.Id &&
                ctl.IsActive, ct);

        if (!hasActiveLink)
        {
            ThrowError("You do not have an active relationship with this client.");
            return;
        }

        // Find the collaborator's TrainerProfile by PublicId
        var collaboratorProfile = await db.TrainerProfiles
            .Include(tp => tp.User)
            .FirstOrDefaultAsync(tp => tp.PublicId == req.CollaboratorPublicId, ct);

        if (collaboratorProfile is null)
        {
            ThrowError("Collaborator not found.");
            return;
        }

        // Check if the collaborator already has a link to this client
        var collaboratorAlreadyLinked = await db.ClientTrainerLinks
            .AsNoTracking()
            .AnyAsync(ctl =>
                ctl.TrainerProfileId == collaboratorProfile.Id &&
                ctl.ClientProfileId == clientProfile.Id, ct);

        if (collaboratorAlreadyLinked)
        {
            ThrowError("This collaborator already has a link to the specified client.");
            return;
        }

        // Determine the collaborator's role
        var collaboratorRoles = await userManager.GetRolesAsync(collaboratorProfile.User);
        var collaboratorRole = collaboratorRoles.Contains(AppRoles.Nutritionist)
            ? UserRole.Nutritionist
            : UserRole.Trainer;

        // Create the new ClientTrainerLink
        var link = new ClientTrainerLink
        {
            ClientProfileId = clientProfile.Id,
            TrainerProfileId = collaboratorProfile.Id,
            TrainerRole = collaboratorRole,
            IsActive = true
        };

        db.ClientTrainerLinks.Add(link);
        await db.SaveChangesAsync(ct);

        await Send.ResponseAsync(new CreateCollaborationResponse
        {
            Message = "Collaboration created successfully."
        }, 201, ct);
    }
}
