using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.UpdateResponse;

public class UpdateResponseEndpoint(IApplicationDbContext db)
    : Endpoint<UpdateResponseRequest>
{
    public override void Configure()
    {
        Put("/client/questionnaire/response/{ResponsePublicId:guid}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Update questionnaire response";
            s.Description = "Saves or updates answers for an in-progress questionnaire response.";
        });
    }

    public override async Task HandleAsync(UpdateResponseRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        // 1. Find response and verify ownership + status
        var response = await db.QuestionnaireResponses
            .Include(r => r.Answers)
            .FirstOrDefaultAsync(r => r.PublicId == req.ResponsePublicId, ct);

        if (response is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (response.ClientId != userGuid)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        if (response.Status == QuestionnaireResponseStatus.Submitted)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Response has already been submitted." },
                409, cancellation: ct);
            return;
        }

        // Transition from Pending to InProgress on first answer save
        if (response.Status == QuestionnaireResponseStatus.Pending)
            response.Status = QuestionnaireResponseStatus.InProgress;

        // 2. Resolve question PublicIds to internal Ids
        var questionPublicIds = req.Answers.Select(a => a.QuestionPublicId).ToList();
        var questionMap = await db.QuestionnaireQuestions
            .Where(q => questionPublicIds.Contains(q.PublicId))
            .ToDictionaryAsync(q => q.PublicId, q => q.Id, ct);

        // 3. Upsert answers
        var existingAnswers = response.Answers.ToDictionary(a => a.QuestionId);

        foreach (var answerDto in req.Answers)
        {
            if (!questionMap.TryGetValue(answerDto.QuestionPublicId, out var questionId))
                continue;

            if (existingAnswers.TryGetValue(questionId, out var existingAnswer))
            {
                // Update existing answer
                existingAnswer.ValueText = answerDto.ValueText;
                existingAnswer.ValueNumber = answerDto.ValueNumber;
                existingAnswer.ValueJson = answerDto.ValueJson;
                existingAnswer.FileUrl = answerDto.FileUrl;
            }
            else
            {
                // Create new answer
                var newAnswer = new QuestionnaireAnswer
                {
                    PublicId = Guid.NewGuid(),
                    ResponseId = response.Id,
                    QuestionId = questionId,
                    ValueText = answerDto.ValueText,
                    ValueNumber = answerDto.ValueNumber,
                    ValueJson = answerDto.ValueJson,
                    FileUrl = answerDto.FileUrl,
                };
                db.QuestionnaireAnswers.Add(newAnswer);
            }
        }

        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
