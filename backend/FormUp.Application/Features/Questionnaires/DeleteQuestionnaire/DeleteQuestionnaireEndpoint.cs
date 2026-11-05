using FormUp.Application.Domain.Authorization;
using FormUp.Application.Domain.Enums;
using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Questionnaires.DeleteQuestionnaire;

public class DeleteQuestionnaireRequest
{
    public Guid PublicId { get; set; }
}

[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class DeleteQuestionnaireEndpoint(IApplicationDbContext db)
    : Endpoint<DeleteQuestionnaireRequest>
{
    public override void Configure()
    {
        Delete("/trainer/questionnaires/{PublicId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete questionnaire";
            s.Description = "Soft-deletes a questionnaire by setting IsActive to false.";
        });
    }

    public override async Task HandleAsync(DeleteQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        var questionnaire = await db.Questionnaires
            .FirstOrDefaultAsync(q => q.PublicId == req.PublicId, ct);

        if (questionnaire is null || questionnaire.ProfessionalId != userGuid)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        questionnaire.IsActive = false;
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(new { Message = "Questionnaire deactivated." }, ct);
    }
}
