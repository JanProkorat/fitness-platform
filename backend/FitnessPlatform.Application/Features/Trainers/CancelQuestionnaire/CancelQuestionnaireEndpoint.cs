using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.CancelQuestionnaire;

public class CancelQuestionnaireRequest
{
    public Guid ClientPublicId { get; set; }
}

public class CancelQuestionnaireEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    ILogger<CancelQuestionnaireEndpoint> logger)
    : Endpoint<CancelQuestionnaireRequest>
{
    public override void Configure()
    {
        Post("/trainer/clients/{ClientPublicId}/cancel-questionnaire");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Cancel a pending questionnaire";
            s.Description = "Cancels a pending questionnaire response for a client.";
        });
    }

    public override async Task HandleAsync(CancelQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == userGuid, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientPublicId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var link = await db.ClientProfessionalLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(l =>
                l.ClientProfileId == clientProfile.Id &&
                l.ProfessionalProfileId == professionalProfile.Id &&
                l.IsActive, ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var response = await db.QuestionnaireResponses
            .Include(r => r.Questionnaire)
            .Where(r => r.ClientId == clientProfile.UserId
                     && r.ProfessionalId == userGuid
                     && (r.Status == QuestionnaireResponseStatus.Pending || r.Status == QuestionnaireResponseStatus.InProgress))
            .OrderByDescending(r => r.DateCreated)
            .FirstOrDefaultAsync(ct);

        if (response is null)
        {
            ThrowError("No pending questionnaire found for this client.");
            return;
        }

        response.Status = QuestionnaireResponseStatus.Cancelled;
        await db.SaveChangesAsync(ct);

        var profUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);
        var profName = $"{profUser.FirstName} {profUser.LastName}";

        await notificationService.CreateAsync(
            clientProfile.UserId,
            NotificationType.QuestionnaireAssigned,
            new Dictionary<string, string> { ["profName"] = profName },
            variant: NotificationTemplates.QuestionnaireAssignedRevoked,
            ct: ct);

        await notifier.NotifyAsync(clientProfile.UserId, "questionnairecancelled", new
        {
            QuestionnaireTitle = response.Questionnaire.Title,
        }, ct);

        logger.LogInformation(
            "Questionnaire response {ResponseId} cancelled by professional {ProfessionalId} for client {ClientId}",
            response.PublicId, professionalProfile.PublicId, clientProfile.PublicId);

        await Send.NoContentAsync(ct);
    }
}
