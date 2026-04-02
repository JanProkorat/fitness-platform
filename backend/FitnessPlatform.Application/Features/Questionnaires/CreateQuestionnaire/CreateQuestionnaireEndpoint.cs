using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Questionnaires.GetTrainerQuestionnaire;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.CreateQuestionnaire;

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
        });
    }

    public override async Task HandleAsync(CreateQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        // If this is the first questionnaire for the professional, make it the default
        var hasAny = await db.Questionnaires.AnyAsync(q => q.ProfessionalId == userGuid, ct);

        var questionnaire = new Questionnaire
        {
            PublicId = Guid.NewGuid(),
            ProfessionalId = userGuid,
            Title = req.Title,
            Description = req.Description,
            IsActive = true,
            IsDefault = !hasAny,
        };

        db.Questionnaires.Add(questionnaire);
        await db.SaveChangesAsync(ct);

        await Send.ResponseAsync(new GetTrainerQuestionnaireResponse
        {
            PublicId = questionnaire.PublicId,
            Title = questionnaire.Title,
            Description = questionnaire.Description,
            IsActive = questionnaire.IsActive,
            IsDefault = questionnaire.IsDefault,
            Questions = [],
        }, 201, ct);
    }
}
