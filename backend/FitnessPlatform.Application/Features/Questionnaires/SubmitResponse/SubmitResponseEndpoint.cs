using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Questionnaires.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.SubmitResponse;

public class SubmitResponseEndpoint(IApplicationDbContext db, IProfileMapperService mapper)
    : EndpointWithoutRequest
{
    public override void Configure()
    {
        Post("/client/questionnaire/response/{responsePublicId}/submit");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Submit questionnaire response";
            s.Description = "Marks a questionnaire response as submitted. Every required, visible question needs an answer; file_upload questions are not enforced yet.";
            s.Responses[StatusCodes.Status200OK] = "Response submitted";
            s.Responses[StatusCodes.Status400BadRequest] = "A required question has no answer (QUESTIONNAIRE_REQUIRED_ANSWER_MISSING)";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The response belongs to another client";
            s.Responses[StatusCodes.Status404NotFound] = "Unknown response, or one outside the current collaboration";
            s.Responses[StatusCodes.Status409Conflict] = "The response is not open for submission";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        var responsePublicId = Route<Guid>("responsePublicId");

        // 1. Find response by PublicId
        var response = await db.QuestionnaireResponses
            .Include(r => r.Link)
            .FirstOrDefaultAsync(r => r.PublicId == responsePublicId, ct);

        if (response is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 2. Verify ownership
        if (response.ClientId != userGuid)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var clientProfileId = await db.ClientProfiles
            .Where(cp => cp.UserId == userGuid)
            .Select(cp => (long?)cp.Id)
            .FirstOrDefaultAsync(ct);

        // A response of an ended or earlier collaboration is indistinguishable from an unknown one.
        if (clientProfileId is null
            || response.Link.ClientProfileId != clientProfileId
            || !response.Link.IsActive
            || (response.Link.ActivatedAtUtc != null && response.DateCreated < response.Link.ActivatedAtUtc))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 3. Verify status allows submission (Pending or InProgress)
        if (response.Status != QuestionnaireResponseStatus.Pending && response.Status != QuestionnaireResponseStatus.InProgress)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Response cannot be submitted in its current state." },
                409, cancellation: ct);
            return;
        }

        // 4. Every required, visible, answerable question needs a non-blank answer
        var answeredQuestionIds = (await db.QuestionnaireAnswers
                .Where(a => a.ResponseId == response.Id)
                .Select(a => new { a.QuestionId, a.ValueText, a.ValueNumber, a.ValueJson, a.FileUrl })
                .ToListAsync(ct))
            .Where(a => !AnswerValueChecker.IsBlank(a.ValueText, a.ValueNumber, a.ValueJson, a.FileUrl))
            .Select(a => a.QuestionId)
            .ToHashSet();

        var requiredQuestionIds = await db.QuestionnaireQuestions
            .Where(q => q.QuestionnaireId == response.QuestionnaireId
                        && q.IsRequired
                        && !q.IsHidden
                        && q.Type != QuestionTypes.Section
                        // File answers cannot be uploaded yet, so they are not enforced; #1850 removes this.
                        && q.Type != QuestionTypes.FileUpload)
            .Select(q => q.Id)
            .ToListAsync(ct);

        if (requiredQuestionIds.Any(id => !answeredQuestionIds.Contains(id)))
        {
            this.ThrowErrorWithCode(
                ErrorCodes.QuestionnaireRequiredAnswerMissing,
                "A required question has no answer.");
            return;
        }

        // 5. Update status
        response.Status = QuestionnaireResponseStatus.Submitted;
        response.SubmittedAt = DateTime.UtcNow;

        // 6. Auto-create a BodyMeasurement if any answer maps to weight.
        //    This makes questionnaire-reported weight appear in the weight
        //    progress history, chart, sparkline, and stats automatically.
        var weightAnswer = await db.QuestionnaireAnswers
            .Include(a => a.Question)
            .Where(a => a.ResponseId == response.Id
                        && a.Question.MappedField == "WeightKg"
                        && a.ValueNumber != null)
            .FirstOrDefaultAsync(ct);

        if (weightAnswer is not null)
        {
            var clientProfile = await db.ClientProfiles
                .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

            if (clientProfile is not null)
            {
                db.BodyMeasurements.Add(new BodyMeasurement
                {
                    ClientProfileId = clientProfile.Id,
                    MeasuredAt = response.SubmittedAt.Value,
                    WeightKg = weightAnswer.ValueNumber,
                    Notes = "questionnaire",
                });
            }
        }

        // Map answers to client profile and notify professional (also calls SaveChangesAsync)
        await mapper.MapResponseToProfileAsync(response, ct);

        await Send.OkAsync(new { Message = "Questionnaire submitted successfully." }, ct);
    }
}
