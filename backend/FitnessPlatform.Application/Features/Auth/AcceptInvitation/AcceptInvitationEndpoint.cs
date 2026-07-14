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
/// <param name="notificationService">Creates the in-app notification for the professional (#770).</param>
/// <param name="notifier">Broadcasts the "inviteaccepted" SignalR event to the professional (#770).</param>
public class AcceptInvitationEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    IAuditService audit,
    INotificationService notificationService,
    IRealtimeNotifier notifier)
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
            // Determine the professional's role from their Identity roles. Grant view
            // access per role actually held (independent booleans), not a single
            // tie-broken role — a professional can hold BOTH Trainer and Nutritionist
            // roles simultaneously and must keep access to both plan types (#776).
            var professionalUser = await userManager.FindByIdAsync(invitation.ProfessionalProfile.UserId.ToString());
            var professionalRoles = professionalUser is not null
                ? await userManager.GetRolesAsync(professionalUser)
                : [];

            var professionalIsTrainer = professionalRoles.Contains(AppRoles.Trainer);
            var professionalIsNutritionist = professionalRoles.Contains(AppRoles.Nutritionist);
            var professionalRole = professionalIsNutritionist ? UserRole.Nutritionist : UserRole.Trainer;

            // Find matching pending invite to get questionnaire assignment
            var pendingInvite = await db.PendingInvites
                .FirstOrDefaultAsync(pi => pi.ProfessionalProfileId == invitation.ProfessionalProfileId
                    && pi.Email == invitation.Email
                    && !pi.IsAccepted, ct);

            var link = new ClientProfessionalLink
            {
                ClientProfileId = clientProfile.Id,
                ProfessionalProfileId = invitation.ProfessionalProfileId,
                ProfessionalRole = professionalRole,
                IsActive = true,
                CanViewNutritionPlans = professionalIsNutritionist,
                CanViewTrainingPlans = professionalIsTrainer,
                QuestionnaireId = pendingInvite?.QuestionnaireId
            };

            db.ClientProfessionalLinks.Add(link);

            // Mark the pending invite as accepted
            if (pendingInvite is not null)
            {
                pendingInvite.IsAccepted = true;
            }
        }

        // Mark invitation as used
        invitation.IsUsed = true;

        // Auto-confirm email since user clicked the invitation link
        var currentUser = await userManager.FindByIdAsync(userGuid.ToString());
        if (currentUser is not null && !currentUser.EmailConfirmed)
        {
            currentUser.EmailConfirmed = true;
        }

        await db.SaveChangesAsync(ct);

        // Audit: new data sharing relationship established
        await audit.LogAsync(
            userGuid,
            "AcceptInvitation",
            nameof(ClientProfessionalLink),
            invitation.ProfessionalProfile.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct: ct);

        // Notify the professional that their (token-based) invitation was accepted (#770).
        // This flow previously created the ClientProfessionalLink with no notification or
        // SignalR emit at all, so the professional's notification bell and web client-list
        // never learned about the new link until an unrelated action refreshed the page.
        // Mirrors the pattern used by AcceptClientInviteEndpoint for the in-app invite flow.
        var clientName = currentUser is not null
            ? $"{currentUser.FirstName} {currentUser.LastName}"
            : "A client";

        await notificationService.CreateAsync(
            invitation.ProfessionalProfile.UserId,
            NotificationType.ClientRequestAccepted,
            "Invitation accepted",
            $"{clientName} accepted your invitation.",
            ct: ct);

        await notifier.NotifyAsync(
            invitation.ProfessionalProfile.UserId,
            "inviteaccepted",
            new { clientName },
            ct);

        await Send.OkAsync(new AcceptInvitationResponse
        {
            Message = "Invitation accepted successfully.",
            TrainerPublicId = invitation.ProfessionalProfile.PublicId
        }, ct);
    }
}
