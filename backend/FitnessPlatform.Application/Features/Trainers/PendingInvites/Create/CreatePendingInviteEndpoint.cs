using System.Security.Claims;
using System.Security.Cryptography;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;

/// <summary>
/// Endpoint for creating a pending client invitation.
/// Creates both a PendingInvite record and an InvitationToken, then sends the invitation email.
/// Also creates an in-app notification and sends a real-time event if the client already has an account.
/// </summary>
public class CreatePendingInviteEndpoint(
    IApplicationDbContext db,
    IEmailService emailService,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    IConversationSeedService conversationSeedService,
    ILogger<CreatePendingInviteEndpoint> logger) : Endpoint<CreatePendingInviteRequest, CreatePendingInviteResponse>
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

        // Resolve optional questionnaire
        long? questionnaireId = null;
        if (req.QuestionnairePublicId.HasValue)
        {
            var questionnaire = await db.Questionnaires
                .FirstOrDefaultAsync(q => q.PublicId == req.QuestionnairePublicId.Value
                    && q.ProfessionalId == Guid.Parse(userId), ct);
            questionnaireId = questionnaire?.Id;
        }

        // Create the PendingInvite record
        var pendingInvite = new PendingInvite
        {
            ProfessionalProfileId = professionalProfile.Id,
            FirstName = req.FirstName,
            LastName = req.LastName,
            Email = req.Email,
            Message = req.Message,
            SentAt = DateTime.UtcNow,
            QuestionnaireId = questionnaireId
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
        await emailService.SendInvitationEmailAsync(req.Email, trainerName, tokenValue, language, req.Message, ct);

        // If the invited client already has an account, create an in-app notification + real-time event
        var reqEmailLower = req.Email.ToLower();
        var existingUser = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email!.ToLower() == reqEmailLower, ct);

        if (existingUser is not null)
        {
            // Find or create a conversation between the professional and the existing
            // user, and — if a message was provided — seed it as the conversation's
            // first message (shared with the accept-time seeding in
            // AcceptClientInviteEndpoint / AcceptInvitationEndpoint, #768).
            var professionalUserId = professionalProfile.UserId;

            await conversationSeedService.GetOrSeedConversationAsync(
                professionalUserId, existingUser.Id, professionalUserId, trainerName, req.Message,
                seedIntoExisting: true, ct: ct);

            var notifBody = $"{trainerName} invited you to join as their client.";

            await notificationService.CreateAsync(
                existingUser.Id,
                NotificationType.InvitationReceived,
                "New invitation",
                notifBody,
                System.Text.Json.JsonSerializer.Serialize(new { inviteId = pendingInvite.PublicId }),
                ct);

            var senderRole = User.IsInRole(AppRoles.Nutritionist) ? "Nutritionist" : "Trainer";

            await notifier.NotifyAsync(
                existingUser.Id,
                "invitationreceived",
                new
                {
                    id = pendingInvite.PublicId,
                    trainerId = professionalProfile.PublicId,
                    trainerName,
                    trainerRole = senderRole,
                    trainerCity = professionalProfile.City ?? string.Empty,
                    message = pendingInvite.Message
                },
                ct);
        }

        logger.LogInformation(
            "Pending invitation created from professional {ProfessionalId} to {Email}",
            professionalProfile.PublicId, req.Email);

        await Send.ResponseAsync(new CreatePendingInviteResponse
        {
            Id = pendingInvite.Id,
            PublicId = pendingInvite.PublicId,
            FirstName = pendingInvite.FirstName,
            LastName = pendingInvite.LastName,
            Email = pendingInvite.Email,
            SentAt = pendingInvite.SentAt,
            QuestionnairePublicId = req.QuestionnairePublicId
        }, cancellation: ct);
    }
}
