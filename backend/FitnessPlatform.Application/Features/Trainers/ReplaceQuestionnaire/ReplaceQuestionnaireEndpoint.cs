using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.ReplaceQuestionnaire;

public class ReplaceQuestionnaireRequest
{
    public Guid ClientPublicId { get; set; }
    public Guid QuestionnairePublicId { get; set; }
}

public class ReplaceQuestionnaireEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    ILogger<ReplaceQuestionnaireEndpoint> logger)
    : Endpoint<ReplaceQuestionnaireRequest>
{
    public override void Configure()
    {
        Post("/trainer/clients/{ClientPublicId}/replace-questionnaire");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Replace a pending questionnaire";
            s.Description = "Cancels the current pending questionnaire and assigns a new one.";
        });
    }

    public override async Task HandleAsync(ReplaceQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var professionalProfile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(pp => pp.UserId == userGuid, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientPublicId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var link = await db.ClientProfessionalLinks
            .FirstOrDefaultAsync(l =>
                l.ClientProfileId == clientProfile.Id &&
                l.ProfessionalProfileId == professionalProfile.Id &&
                l.IsActive, ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Cancel old response
        var oldResponse = await db.QuestionnaireResponses
            .Where(r => r.ClientId == clientProfile.UserId
                     && r.ProfessionalId == userGuid
                     && (r.Status == QuestionnaireResponseStatus.Pending || r.Status == QuestionnaireResponseStatus.InProgress))
            .OrderByDescending(r => r.DateCreated)
            .FirstOrDefaultAsync(ct);

        if (oldResponse is null)
        {
            ThrowError("No pending questionnaire found for this client.");
            return;
        }

        // Find new questionnaire
        var questionnaire = await db.Questionnaires
            .FirstOrDefaultAsync(q => q.PublicId == req.QuestionnairePublicId
                && q.ProfessionalId == userGuid, ct);

        if (questionnaire is null)
        {
            ThrowError("Questionnaire not found.");
            return;
        }

        oldResponse.Status = QuestionnaireResponseStatus.Cancelled;

        // Update link with new questionnaire
        link.QuestionnaireId = questionnaire.Id;

        // Create new response
        var newResponse = new QuestionnaireResponse
        {
            QuestionnaireId = questionnaire.Id,
            ClientId = clientProfile.UserId,
            ProfessionalId = userGuid,
            LinkId = link.Id,
            Status = QuestionnaireResponseStatus.Pending,
        };
        db.QuestionnaireResponses.Add(newResponse);

        await db.SaveChangesAsync(ct);

        var profUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);
        var profName = $"{profUser.FirstName} {profUser.LastName}";

        // Notify client: old cancelled, new assigned
        await notifier.NotifyAsync(clientProfile.UserId, "questionnaireCancelled", new
        {
            QuestionnaireTitle = oldResponse.Questionnaire?.Title ?? "",
        }, ct);

        await notificationService.CreateAsync(
            clientProfile.UserId,
            NotificationType.QuestionnaireAssigned,
            "Questionnaire assigned",
            $"You have been assigned a new questionnaire: {questionnaire.Title}",
            ct: ct);

        await notifier.NotifyAsync(clientProfile.UserId, "questionnaireAssigned", new
        {
            QuestionnairePublicId = questionnaire.PublicId,
            questionnaire.Title,
        }, ct);

        logger.LogInformation(
            "Questionnaire replaced for client {ClientId}: old {OldId} cancelled, new {NewId} assigned by {ProfessionalId}",
            clientProfile.PublicId, oldResponse.PublicId, newResponse.PublicId, professionalProfile.PublicId);

        await Send.NoContentAsync(ct);
    }
}
