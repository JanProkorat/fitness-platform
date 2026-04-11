using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.AcceptClientRequest;

/// <summary>
/// Endpoint for a professional to accept a client request, creating a link and optionally assigning a questionnaire.
/// </summary>
public class AcceptClientRequestEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    UserManager<ApplicationUser> userManager,
    ILogger<AcceptClientRequestEndpoint> logger)
    : Endpoint<AcceptClientRequestRequest>
{
    public override void Configure()
    {
        Post("/trainer/client-requests/{PublicId}/accept");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Accept a client request";
            s.Description = "Accepts a pending client request, creates a client-professional link, and optionally assigns a questionnaire.";
        });
    }

    public override async Task HandleAsync(AcceptClientRequestRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var professionalProfile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(pp => pp.UserId == userGuid, ct);

        if (professionalProfile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.TrainerProfileMissing, "Professional profile not found.");
            return;
        }

        var clientRequest = await db.ClientRequests
            .Include(r => r.ClientProfile)
                .ThenInclude(cp => cp.User)
            .FirstOrDefaultAsync(r => r.PublicId == req.PublicId, ct);

        if (clientRequest is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "Client request not found.");
            return;
        }

        if (clientRequest.ProfessionalProfileId != professionalProfile.Id)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "Client request not found.");
            return;
        }

        if (clientRequest.Status != ClientRequestStatus.Pending)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientRequestNotFound, "This request has already been processed.");
            return;
        }

        // Determine professional role from identity roles
        var professionalRole = User.IsInRole(AppRoles.Nutritionist)
            ? UserRole.Nutritionist
            : UserRole.Trainer;

        // Update request status
        clientRequest.Status = ClientRequestStatus.Accepted;
        clientRequest.RespondedAt = DateTime.UtcNow;
        clientRequest.Statement = req.Statement;

        // Create or reactivate the client-professional link
        var link = await db.ClientProfessionalLinks
            .FirstOrDefaultAsync(l =>
                l.ClientProfileId == clientRequest.ClientProfileId &&
                l.ProfessionalProfileId == professionalProfile.Id, ct);

        if (link is not null)
        {
            link.IsActive = true;
            link.ProfessionalRole = professionalRole;
            link.CanViewNutritionPlans = professionalRole == UserRole.Nutritionist;
            link.CanViewTrainingPlans = professionalRole == UserRole.Trainer;
        }
        else
        {
            link = new ClientProfessionalLink
            {
                ClientProfileId = clientRequest.ClientProfileId,
                ProfessionalProfileId = professionalProfile.Id,
                ProfessionalRole = professionalRole,
                IsActive = true,
                CanViewNutritionPlans = professionalRole == UserRole.Nutritionist,
                CanViewTrainingPlans = professionalRole == UserRole.Trainer
            };
            db.ClientProfessionalLinks.Add(link);
        }

        // Handle optional questionnaire assignment
        Questionnaire? questionnaire = null;
        if (req.QuestionnairePublicId.HasValue)
        {
            questionnaire = await db.Questionnaires
                .FirstOrDefaultAsync(q => q.PublicId == req.QuestionnairePublicId.Value
                    && q.ProfessionalId == userGuid, ct);

            if (questionnaire is not null)
            {
                link.QuestionnaireId = questionnaire.Id;
                clientRequest.QuestionnaireId = questionnaire.Id;
            }
        }

        await db.SaveChangesAsync(ct);

        // Create QuestionnaireResponse after save so link.Id is generated
        if (questionnaire is not null)
        {
            var questionnaireResponse = new QuestionnaireResponse
            {
                QuestionnaireId = questionnaire.Id,
                ClientId = clientRequest.ClientProfile.UserId,
                ProfessionalId = userGuid,
                LinkId = link.Id,
                Status = QuestionnaireResponseStatus.Pending
            };

            db.QuestionnaireResponses.Add(questionnaireResponse);
            await db.SaveChangesAsync(ct);
        }

        // Notify client of acceptance
        var profUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);
        var profName = $"{profUser.FirstName} {profUser.LastName}";

        await notificationService.CreateAsync(
            clientRequest.ClientProfile.UserId,
            NotificationType.InvitationAccepted,
            "Invitation accepted",
            $"{profName} accepted your invitation.",
            ct: ct);

        await notifier.NotifyAsync(clientRequest.ClientProfile.UserId, "clientRequestAccepted", new
        {
            RequestPublicId = clientRequest.PublicId,
            ProfessionalProfilePublicId = professionalProfile.PublicId
        }, ct);

        // Auto-cancel other pending requests from the same client for the same role
        var roleString = professionalRole == UserRole.Nutritionist ? AppRoles.Nutritionist : AppRoles.Trainer;
        var otherPending = await db.ClientRequests
            .Include(r => r.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Where(r => r.ClientProfileId == clientRequest.ClientProfileId
                     && r.Id != clientRequest.Id
                     && r.Status == ClientRequestStatus.Pending)
            .ToListAsync(ct);

        // Filter by role — need to check each professional's identity role
        var clientUser = clientRequest.ClientProfile.User;
        var clientName = $"{clientUser.FirstName} {clientUser.LastName}";

        foreach (var other in otherPending)
        {
            var otherProfRoles = await userManager.GetRolesAsync(other.ProfessionalProfile.User);
            if (!otherProfRoles.Contains(roleString)) continue;

            other.Status = ClientRequestStatus.Cancelled;
            other.RespondedAt = DateTime.UtcNow;

            await notifier.NotifyAsync(other.ProfessionalProfile.UserId, "clientRequestCancelled", new
            {
                RequestPublicId = other.PublicId,
                ClientName = clientName
            }, ct);
        }

        // Save status changes for cancelled requests
        await db.SaveChangesAsync(ct);

        // Now create notifications for cancelled professionals
        foreach (var other in otherPending.Where(o => o.Status == ClientRequestStatus.Cancelled))
        {
            await notificationService.CreateAsync(
                other.ProfessionalProfile.UserId,
                NotificationType.InvitationCancelled,
                "Invitation cancelled",
                $"{clientName} accepted another {roleString.ToLowerInvariant()}, so your invitation was cancelled.",
                ct: ct);
        }

        // Questionnaire notification
        if (questionnaire is not null)
        {
            await notificationService.CreateAsync(
                clientRequest.ClientProfile.UserId,
                NotificationType.QuestionnaireAssigned,
                "Questionnaire assigned",
                $"You have been assigned a questionnaire: {questionnaire.Title}",
                ct: ct);

            await notifier.NotifyAsync(clientRequest.ClientProfile.UserId, "questionnaireAssigned", new
            {
                QuestionnairePublicId = questionnaire.PublicId,
                questionnaire.Title
            }, ct);
        }

        // Send statement as a chat message if provided
        if (!string.IsNullOrWhiteSpace(req.Statement))
        {
            var conversation = await db.Conversations
                .FirstOrDefaultAsync(c =>
                    c.ProfessionalUserId == userGuid &&
                    c.ClientUserId == clientRequest.ClientProfile.UserId, ct);

            if (conversation is null)
            {
                conversation = new Conversation
                {
                    ProfessionalUserId = userGuid,
                    ClientUserId = clientRequest.ClientProfile.UserId,
                };
                db.Conversations.Add(conversation);
                await db.SaveChangesAsync(ct);
            }

            var chatMessage = new ChatMessage
            {
                ConversationId = conversation.Id,
                SenderUserId = userGuid,
                Text = req.Statement,
                IsRead = false,
            };
            db.ChatMessages.Add(chatMessage);

            conversation.LastMessageText = req.Statement.Length > 300
                ? req.Statement[..300]
                : req.Statement;
            conversation.LastMessageAt = DateTime.UtcNow;
            conversation.LastMessageSenderId = userGuid;

            await db.SaveChangesAsync(ct);

            await notifier.NotifyAsync(clientRequest.ClientProfile.UserId, "newMessage", new
            {
                ConversationId = conversation.PublicId,
                SenderName = profName,
            }, ct);
        }

        logger.LogInformation(
            "Client request {RequestId} accepted by professional {ProfessionalId}",
            clientRequest.PublicId, professionalProfile.PublicId);

        await Send.NoContentAsync(ct);
    }
}
