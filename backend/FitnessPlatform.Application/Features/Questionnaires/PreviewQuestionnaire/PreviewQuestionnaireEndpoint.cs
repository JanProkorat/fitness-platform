using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Questionnaires.Dtos;
using FitnessPlatform.Application.Features.Questionnaires.GetTrainerQuestionnaire;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.PreviewQuestionnaire;

public class PreviewQuestionnaireRequest
{
    public Guid PublicId { get; set; }
}

public class PreviewQuestionnaireEndpoint(IApplicationDbContext db)
    : Endpoint<PreviewQuestionnaireRequest, GetTrainerQuestionnaireResponse>
{
    public override void Configure()
    {
        Get("/trainer/questionnaires/{PublicId}/preview");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Preview questionnaire";
            s.Description = "Returns the questionnaire as a client would see it, excluding hidden questions.";
        });
    }

    public override async Task HandleAsync(PreviewQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        var questionnaire = await db.Questionnaires
            .Include(q => q.Questions
                .Where(qq => !qq.IsHidden)
                .OrderBy(qq => qq.OrderIndex))
            .FirstOrDefaultAsync(q => q.PublicId == req.PublicId, ct);

        if (questionnaire is null || questionnaire.ProfessionalId != userGuid)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(new GetTrainerQuestionnaireResponse
        {
            PublicId = questionnaire.PublicId,
            Title = questionnaire.Title,
            Description = questionnaire.Description,
            IsActive = questionnaire.IsActive,
            IsDefault = questionnaire.IsDefault,
            Questions = questionnaire.Questions.Select(qq => new QuestionDto
            {
                PublicId = qq.PublicId,
                OrderIndex = qq.OrderIndex,
                Type = qq.Type,
                Label = qq.Label,
                HelperText = qq.HelperText,
                IsRequired = qq.IsRequired,
                IsHidden = qq.IsHidden,
                Config = qq.Config,
                MappedField = qq.MappedField,
            }).ToList(),
        }, ct);
    }
}
