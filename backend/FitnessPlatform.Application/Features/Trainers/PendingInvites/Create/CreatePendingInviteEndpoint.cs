using System.Security.Claims;
using System.Security.Cryptography;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;

/// <summary>
/// Endpoint for creating a pending client invitation.
/// Creates both a PendingInvite record and an InvitationToken, then sends the invitation email.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="emailService">Email service for sending invitation emails.</param>
/// <param name="logger">Logger instance.</param>
public class CreatePendingInviteEndpoint(IApplicationDbContext db, IEmailService emailService, ILogger<CreatePendingInviteEndpoint> logger) : Endpoint<CreatePendingInviteRequest, CreatePendingInviteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/pending-invites");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Create a pending invitation";
            s.Description = "Creates a pending invitation for a client, sends an invitation email with a one-time token valid for 7 days.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreatePendingInviteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            ThrowError("Professional profile not found. Please complete your profile setup first.");
            return;
        }

        // Create the PendingInvite record
        var pendingInvite = new PendingInvite
        {
            ProfessionalProfileId = professionalProfile.Id,
            FirstName = req.FirstName,
            LastName = req.LastName,
            Email = req.Email,
            SentAt = DateTime.UtcNow
        };

        db.PendingInvites.Add(pendingInvite);

        // Create the InvitationToken so the accept flow still works
        var tokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

        var invitation = new InvitationToken
        {
            ProfessionalProfileId = professionalProfile.Id,
            Email = req.Email,
            Token = tokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        db.InvitationTokens.Add(invitation);
        await db.SaveChangesAsync(ct);

        // Send invitation email
        var trainerUser = await db.Users.FirstAsync(u => u.Id == professionalProfile.UserId, ct);
        var trainerName = $"{trainerUser.FirstName} {trainerUser.LastName}";

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";
        await emailService.SendInvitationEmailAsync(req.Email, trainerName, tokenValue, language, ct);

        logger.LogInformation(
            "Pending invitation created from professional {ProfessionalId} to {Email}",
            professionalProfile.PublicId, req.Email);

        await Send.ResponseAsync(new CreatePendingInviteResponse
        {
            PublicId = pendingInvite.PublicId,
            FirstName = pendingInvite.FirstName,
            LastName = pendingInvite.LastName,
            Email = pendingInvite.Email,
            SentAt = pendingInvite.SentAt
        }, cancellation: ct);
    }
}
