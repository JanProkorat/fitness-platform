using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.AssignQuestionnaire;

/// <summary>
/// Endpoint for a professional to assign a questionnaire to an existing linked client.
/// </summary>
public class AssignQuestionnaireEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    ILogger<AssignQuestionnaireEndpoint> logger)
    : Endpoint<AssignQuestionnaireRequest>
{
    public override void Configure()
    {
        Post("/trainer/clients/{ClientPublicId}/assign-questionnaire");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Assign a questionnaire to a client";
            s.Description = "Assigns a questionnaire to an existing linked client, creating a pending response.";
        });
    }

    public override async Task HandleAsync(AssignQuestionnaireRequest req, CancellationToken ct)
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

        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientPublicId, ct);

        if (clientProfile is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.ClientNotFound, "Client not found.");
            return;
        }

        // Verify active link exists
        var link = await db.ClientProfessionalLinks
            .FirstOrDefaultAsync(l => l.ClientProfileId == clientProfile.Id
                                   && l.ProfessionalProfileId == professionalProfile.Id
                                   && l.IsActive, ct);

        if (link is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.NoClientRelationship, "No active relationship with this client.");
            return;
        }

        var questionnaire = await db.Questionnaires
            .FirstOrDefaultAsync(q => q.PublicId == req.QuestionnairePublicId
                && q.ProfessionalId == userGuid, ct);

        if (questionnaire is null)
        {
            ThrowError("Questionnaire not found.");
            return;
        }

        // Update link with questionnaire
        link.QuestionnaireId = questionnaire.Id;

        // Create questionnaire response
        var questionnaireResponse = new QuestionnaireResponse
        {
            QuestionnaireId = questionnaire.Id,
            ClientId = clientProfile.UserId,
            ProfessionalId = userGuid,
            LinkId = link.Id,
            Status = QuestionnaireResponseStatus.Pending
        };

        db.QuestionnaireResponses.Add(questionnaireResponse);

        // Save entity changes (link update + questionnaire response) before creating notification
        await db.SaveChangesAsync(ct);

        await notificationService.CreateAsync(
            clientProfile.UserId,
            NotificationType.QuestionnaireAssigned,
            "Questionnaire assigned",
            $"You have been assigned a questionnaire: {questionnaire.Title}",
            ct: ct);

        await notifier.NotifyAsync(clientProfile.UserId, "questionnaireassigned", new
        {
            QuestionnairePublicId = questionnaire.PublicId,
            questionnaire.Title
        }, ct);

        logger.LogInformation(
            "Questionnaire {QuestionnaireId} assigned to client {ClientId} by professional {ProfessionalId}",
            questionnaire.PublicId, clientProfile.PublicId, professionalProfile.PublicId);

        await Send.NoContentAsync(ct);
    }
}
