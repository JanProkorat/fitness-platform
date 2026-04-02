using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.AcceptClientRequest;

/// <summary>
/// Endpoint for a professional to accept a client request, creating a link and optionally assigning a questionnaire.
/// </summary>
public class AcceptClientRequestEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
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

        // Create the client-professional link
        var link = new ClientProfessionalLink
        {
            ClientProfileId = clientRequest.ClientProfileId,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalRole = professionalRole,
            IsActive = true,
            CanViewNutritionPlans = professionalRole == UserRole.Nutritionist,
            CanViewTrainingPlans = professionalRole == UserRole.Trainer
        };

        db.ClientProfessionalLinks.Add(link);

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

        // Create notification for client
        var notification = new Notification
        {
            RecipientUserId = clientRequest.ClientProfile.UserId,
            Type = NotificationType.ClientRequestAccepted,
            Title = "Request accepted",
            Body = "Your request has been accepted."
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);

        await notifier.NotifyAsync(clientRequest.ClientProfile.UserId, "clientRequestAccepted", new
        {
            RequestPublicId = clientRequest.PublicId,
            ProfessionalProfilePublicId = professionalProfile.PublicId
        }, ct);

        if (questionnaire is not null)
        {
            var qNotification = new Notification
            {
                RecipientUserId = clientRequest.ClientProfile.UserId,
                Type = NotificationType.QuestionnaireAssigned,
                Title = "Questionnaire assigned",
                Body = $"You have been assigned a questionnaire: {questionnaire.Title}"
            };

            db.Notifications.Add(qNotification);
            await db.SaveChangesAsync(ct);

            await notifier.NotifyAsync(clientRequest.ClientProfile.UserId, "questionnaireAssigned", new
            {
                QuestionnairePublicId = questionnaire.PublicId,
                questionnaire.Title
            }, ct);
        }

        logger.LogInformation(
            "Client request {RequestId} accepted by professional {ProfessionalId}",
            clientRequest.PublicId, professionalProfile.PublicId);

        await Send.OkAsync(ct);
    }
}
