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
            s.Description = "Returns the active questionnaire for a specific professional link. " +
                            "Pass ?linkPublicId= to select which coach's questionnaire to load. " +
                            "If omitted, falls back to the first active link (legacy behaviour).";
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

        // 2. Resolve the professional link — prefer explicit linkPublicId, fall back to first active
        var linkPublicIdParam = Query<Guid?>("linkPublicId", isRequired: false);

        Domain.Entities.ClientProfessionalLink? link;

        if (linkPublicIdParam.HasValue)
        {
            link = await db.ClientProfessionalLinks
                .Where(l => l.ClientProfileId == clientProfile.Id
                         && l.PublicId == linkPublicIdParam.Value
                         && l.IsActive)
                .FirstOrDefaultAsync(ct);
        }
        else
        {
            // Legacy fallback: first active link
            link = await db.ClientProfessionalLinks
                .Where(l => l.ClientProfileId == clientProfile.Id && l.IsActive)
                .FirstOrDefaultAsync(ct);
        }

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 3. Get the professional's profile
        var professionalProfile = await db.ProfessionalProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == link.ProfessionalProfileId, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 4. Resolve questionnaire: link override → professional default
        Domain.Entities.Questionnaire? questionnaire = null;
        if (link.QuestionnaireId.HasValue)
        {
            questionnaire = await db.Questionnaires
                .Include(q => q.Questions
                    .Where(qq => !qq.IsHidden)
                    .OrderBy(qq => qq.OrderIndex))
                .FirstOrDefaultAsync(q => q.Id == link.QuestionnaireId.Value && q.IsActive, ct);
        }

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

        // 5. Check for an existing pending/in-progress response scoped to this link
        var existingResponse = await db.QuestionnaireResponses
            .Include(r => r.Answers)
            .FirstOrDefaultAsync(r =>
                r.ClientId == userGuid
                && r.LinkId == link.Id
                && r.QuestionnaireId == questionnaire.Id
                && (r.Status == QuestionnaireResponseStatus.Pending || r.Status == QuestionnaireResponseStatus.InProgress), ct);

        var questionLookup = questionnaire.Questions.ToDictionary(q => q.Id, q => q.PublicId);

        await Send.OkAsync(new GetClientQuestionnaireResponse
        {
            QuestionnairePublicId = questionnaire.PublicId,
            Title = questionnaire.Title,
            Description = questionnaire.Description,
            LinkPublicId = link.PublicId,
            ProfessionalName = $"{professionalProfile.User.FirstName} {professionalProfile.User.LastName}",
            ProfessionalRole = link.ProfessionalRole.ToString(),
            ProfessionalCity = professionalProfile.City,
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
