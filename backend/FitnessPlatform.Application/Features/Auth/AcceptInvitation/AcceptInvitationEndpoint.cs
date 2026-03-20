using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Auth.AcceptInvitation;

/// <summary>
/// Endpoint for a client to accept a professional's invitation using a one-time token.
/// Creates or reuses the client's profile and establishes a client-professional link.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="audit">Audit logging service.</param>
public class AcceptInvitationEndpoint(IApplicationDbContext db, UserManager<ApplicationUser> userManager, IAuditService audit)
    : Endpoint<AcceptInvitationRequest, AcceptInvitationResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/invite/accept");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Accept a trainer invitation";
            s.Description = "Accepts a one-time invitation token from a trainer, creating a client-professional relationship.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AcceptInvitationRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        // Find the invitation token (must not be used and not expired)
        var invitation = await db.InvitationTokens
            .Include(i => i.ProfessionalProfile)
            .FirstOrDefaultAsync(i => i.Token == req.Token, ct);

        if (invitation is null)
        {
            ThrowError("Invalid invitation token.");
            return;
        }

        if (invitation.IsUsed)
        {
            ThrowError("This invitation has already been used.");
            return;
        }

        if (invitation.ExpiresAt < DateTime.UtcNow)
        {
            ThrowError("This invitation has expired.");
            return;
        }

        // Find or create the client profile
        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            clientProfile = new ClientProfile
            {
                UserId = userGuid
            };
            db.ClientProfiles.Add(clientProfile);
            await db.SaveChangesAsync(ct);
        }

        // Check if a link already exists between this client and professional
        var existingLink = await db.ClientProfessionalLinks
            .AnyAsync(l => l.ClientProfileId == clientProfile.Id
                           && l.ProfessionalProfileId == invitation.ProfessionalProfileId, ct);

        if (!existingLink)
        {
            // Determine the professional's role from their Identity roles
            var professionalUser = await userManager.FindByIdAsync(invitation.ProfessionalProfile.UserId.ToString());
            var professionalRoles = professionalUser is not null
                ? await userManager.GetRolesAsync(professionalUser)
                : [];

            var professionalRole = professionalRoles.Contains(AppRoles.Nutritionist)
                ? UserRole.Nutritionist
                : UserRole.Trainer;

            var link = new ClientProfessionalLink
            {
                ClientProfileId = clientProfile.Id,
                ProfessionalProfileId = invitation.ProfessionalProfileId,
                ProfessionalRole = professionalRole,
                IsActive = true
            };

            db.ClientProfessionalLinks.Add(link);
        }

        // Mark invitation as used
        invitation.IsUsed = true;

        await db.SaveChangesAsync(ct);

        // Audit: new data sharing relationship established
        await audit.LogAsync(
            userGuid,
            "AcceptInvitation",
            nameof(ClientProfessionalLink),
            invitation.ProfessionalProfile.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        await Send.OkAsync(new AcceptInvitationResponse
        {
            Message = "Invitation accepted successfully.",
            TrainerPublicId = invitation.ProfessionalProfile.PublicId
        }, ct);
    }
}
