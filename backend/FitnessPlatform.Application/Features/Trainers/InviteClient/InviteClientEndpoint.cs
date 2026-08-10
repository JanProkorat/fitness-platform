using System.Security.Claims;
using System.Security.Cryptography;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.InviteClient;

/// <summary>
/// Endpoint for a trainer to send an invitation to a client via email.
/// Creates a one-time invitation token that expires in 7 days.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="emailService">Email service for sending invitation emails.</param>
/// <param name="logger">Logger instance.</param>
public class InviteClientEndpoint(IApplicationDbContext db, IEmailService emailService, ILogger<InviteClientEndpoint> logger) : Endpoint<InviteClientRequest, InviteClientResponse>
{

    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/clients/invite");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Invite a client";
            s.Description = "Sends an invitation email to a client with a one-time token valid for 7 days.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(InviteClientRequest req, CancellationToken ct)
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
            ThrowError("Trainer profile not found. Please complete your profile setup first.");
            return;
        }

        // A requested scope narrows the eventual link's CanView* flags below the full
        // set implied by the inviting professional's held roles — it must never widen
        // them. Reject (400), don't clamp: a request for a domain the professional
        // doesn't hold is a caller error, not something to silently downgrade.
        if (req.RequestedScope == LinkCapabilityScope.NutritionOnly && !User.IsInRole(AppRoles.Nutritionist))
        {
            this.ThrowErrorWithCode(
                ErrorCodes.RequestedScopeExceedsHeldRoles,
                "Requested scope exceeds the caller's held roles.");
            return;
        }

        if (req.RequestedScope == LinkCapabilityScope.TrainingOnly && !User.IsInRole(AppRoles.Trainer))
        {
            this.ThrowErrorWithCode(
                ErrorCodes.RequestedScopeExceedsHeldRoles,
                "Requested scope exceeds the caller's held roles.");
            return;
        }

        var tokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

        var invitation = new InvitationToken
        {
            ProfessionalProfileId = professionalProfile.Id,
            Email = req.Email,
            Token = tokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RequestedScope = req.RequestedScope
        };

        var trainerUser = await db.Users.FirstAsync(u => u.Id == professionalProfile.UserId, ct);
        var trainerName = $"{trainerUser.FirstName} {trainerUser.LastName}";

        db.InvitationTokens.Add(invitation);
        await db.SaveChangesAsync(ct);

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";
        await emailService.SendInvitationEmailAsync(req.Email, trainerName, tokenValue, language, null, ct);

        logger.LogInformation(
            "Invitation sent from trainer {TrainerId} to {Email}",
            professionalProfile.PublicId, req.Email);

        await Send.ResponseAsync(new InviteClientResponse
        {
            Message = "Invitation sent successfully.",
            InvitationToken = tokenValue
        }, cancellation: ct);
    }
}
