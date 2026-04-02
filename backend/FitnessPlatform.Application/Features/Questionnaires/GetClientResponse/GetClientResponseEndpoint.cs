using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.GetClientResponse;

public class GetClientResponseEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetClientResponseResponse>
{
    public override void Configure()
    {
        Get("/trainer/clients/{clientPublicId}/questionnaire-response");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get client questionnaire response";
            s.Description = "Returns the submitted questionnaire response for a client.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);
        var clientPublicId = Route<Guid>("clientPublicId");

        var response = await db.QuestionnaireResponses
            .Include(r => r.Answers).ThenInclude(a => a.Question)
            .Include(r => r.Questionnaire)
            .Where(r => r.ClientId == clientPublicId
                     && r.ProfessionalId == userGuid
                     && r.Status == QuestionnaireResponseStatus.Submitted)
            .OrderByDescending(r => r.SubmittedAt)
            .FirstOrDefaultAsync(ct);

        if (response is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(new GetClientResponseResponse
        {
            ResponsePublicId = response.PublicId,
            QuestionnaireTitle = response.Questionnaire.Title,
            SubmittedAt = response.SubmittedAt,
            AnswerCount = response.Answers.Count,
            Answers = response.Answers.Select(a => new ResponseAnswerDto
            {
                QuestionPublicId = a.Question.PublicId,
                QuestionLabel = a.Question.Label,
                QuestionType = a.Question.Type,
                MappedField = a.Question.MappedField,
                ValueText = a.ValueText,
                ValueNumber = a.ValueNumber,
                ValueJson = a.ValueJson,
                FileUrl = a.FileUrl,
            }).ToList(),
        }, ct);
    }
}
