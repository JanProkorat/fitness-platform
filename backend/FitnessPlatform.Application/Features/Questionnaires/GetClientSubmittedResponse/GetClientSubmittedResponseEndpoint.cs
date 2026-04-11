using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.GetClientSubmittedResponse;

public class GetClientSubmittedResponseEndpoint(IApplicationDbContext db) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/client/questionnaire/submitted");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get client's submitted questionnaire";
            s.Description = "Returns the client's most recently submitted questionnaire with answers.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        var response = await db.QuestionnaireResponses
            .AsNoTracking()
            .Include(r => r.Answers).ThenInclude(a => a.Question)
            .Include(r => r.Questionnaire)
            .Where(r => r.ClientId == userGuid
                     && r.Status == QuestionnaireResponseStatus.Submitted)
            .OrderByDescending(r => r.SubmittedAt)
            .FirstOrDefaultAsync(ct);

        if (response is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(new
        {
            QuestionnaireTitle = response.Questionnaire.Title,
            SubmittedAt = response.SubmittedAt,
            Answers = response.Answers
                .OrderBy(a => a.Question.OrderIndex)
                .Where(a => a.Question.Type != "section")
                .Select(a => new
                {
                    Label = a.Question.Label,
                    Type = a.Question.Type,
                    ValueText = a.ValueText,
                    ValueNumber = a.ValueNumber,
                    ValueJson = a.ValueJson,
                    Config = a.Question.Config,
                }).ToList(),
        }, ct);
    }
}
