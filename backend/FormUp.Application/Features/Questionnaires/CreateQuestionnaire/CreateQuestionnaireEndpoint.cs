using FormUp.Application.Domain.Authorization;
using FormUp.Application.Domain.Enums;
using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Features.Questionnaires.GetTrainerQuestionnaire;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Questionnaires.CreateQuestionnaire;

[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
public class CreateQuestionnaireEndpoint(IApplicationDbContext db)
    : Endpoint<CreateQuestionnaireRequest, GetTrainerQuestionnaireResponse>
{
    public override void Configure()
    {
        Post("/trainer/questionnaires");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create questionnaire";
            s.Description = "Creates a new questionnaire template for the authenticated professional.";
            s.Response<GetTrainerQuestionnaireResponse>(201, "Questionnaire created");
        });
    }

    public override async Task HandleAsync(CreateQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        // The first Onboarding form for the professional becomes the default; Check-in forms never do
        var hasAnyOnboarding = await db.Questionnaires
            .AnyAsync(q => q.ProfessionalId == userGuid && q.Type == QuestionnaireType.Onboarding, ct);

        var questionnaire = new Questionnaire
        {
            PublicId = Guid.NewGuid(),
            ProfessionalId = userGuid,
            Title = req.Title,
            Description = req.Description,
            Type = req.Type,
            IsActive = true,
            IsDefault = req.Type == QuestionnaireType.Onboarding && !hasAnyOnboarding,
        };

        db.Questionnaires.Add(questionnaire);
        await db.SaveChangesAsync(ct);

        await Send.ResponseAsync(new GetTrainerQuestionnaireResponse
        {
            PublicId = questionnaire.PublicId,
            Title = questionnaire.Title,
            Description = questionnaire.Description,
            Type = questionnaire.Type,
            IsActive = questionnaire.IsActive,
            IsDefault = questionnaire.IsDefault,
            Questions = [],
        }, 201, ct);
    }
}
