using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.GetClientQuestionnaire;

public class GetClientQuestionnaireEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetClientQuestionnaireResponse>
{
    public override void Configure()
    {
        Get("/client/questionnaire");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get client questionnaire";
            s.Description = "Returns the active questionnaire from the client's professional, including any existing in-progress response.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        // 1. Get the client's profile
        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 2. Get the client's active professional link
        var link = await db.ClientProfessionalLinks
            .Where(l => l.ClientProfileId == clientProfile.Id && l.IsActive)
            .FirstOrDefaultAsync(ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 3. Get the professional's profile
        var professionalProfile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(p => p.Id == link.ProfessionalProfileId, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 4. Get the active questionnaire with visible questions
        // Check if the link has a specific questionnaire assigned
        Domain.Entities.Questionnaire? questionnaire = null;
        if (link.QuestionnaireId.HasValue)
        {
            questionnaire = await db.Questionnaires
                .Include(q => q.Questions
                    .Where(qq => !qq.IsHidden)
                    .OrderBy(qq => qq.OrderIndex))
                .FirstOrDefaultAsync(q => q.Id == link.QuestionnaireId.Value && q.IsActive, ct);
        }

        // Fall back to the professional's default questionnaire
        questionnaire ??= await db.Questionnaires
            .Include(q => q.Questions
                .Where(qq => !qq.IsHidden)
                .OrderBy(qq => qq.OrderIndex))
            .FirstOrDefaultAsync(q => q.ProfessionalId == professionalProfile.UserId && q.IsDefault && q.IsActive, ct);

        if (questionnaire is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 5. Check for an existing in-progress response
        var existingResponse = await db.QuestionnaireResponses
            .Include(r => r.Answers)
            .FirstOrDefaultAsync(r =>
                r.ClientId == userGuid
                && r.QuestionnaireId == questionnaire.Id
                && r.Status != QuestionnaireResponseStatus.Submitted, ct);

        // Build question lookup for answer mapping
        var questionLookup = questionnaire.Questions.ToDictionary(q => q.Id, q => q.PublicId);

        await Send.OkAsync(new GetClientQuestionnaireResponse
        {
            QuestionnairePublicId = questionnaire.PublicId,
            Title = questionnaire.Title,
            Description = questionnaire.Description,
            QuestionCount = questionnaire.Questions.Count,
            Questions = questionnaire.Questions.Select(qq => new ClientQuestionDto
            {
                PublicId = qq.PublicId,
                OrderIndex = qq.OrderIndex,
                Type = qq.Type,
                Label = qq.Label,
                HelperText = qq.HelperText,
                IsRequired = qq.IsRequired,
                Config = qq.Config,
            }).ToList(),
            ExistingResponsePublicId = existingResponse?.PublicId,
            ExistingResponseStatus = existingResponse?.Status.ToString(),
            ExistingAnswers = existingResponse?.Answers.Select(a => new ClientAnswerDto
            {
                QuestionPublicId = questionLookup.GetValueOrDefault(a.QuestionId),
                ValueText = a.ValueText,
                ValueNumber = a.ValueNumber,
                ValueJson = a.ValueJson,
                FileUrl = a.FileUrl,
            }).ToList(),
        }, ct);
    }
}
