using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.GetTrainerQuestionnaire;

public class GetTrainerQuestionnairesResponse
{
    public List<QuestionnaireSummaryDto> Questionnaires { get; set; } = [];
}

public class QuestionnaireSummaryDto
{
    public Guid PublicId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
    public int QuestionCount { get; set; }
    public DateTime DateCreated { get; set; }
}

public class GetTrainerQuestionnairesEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetTrainerQuestionnairesResponse>
{
    public override void Configure()
    {
        Get("/trainer/questionnaires");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List trainer questionnaires";
            s.Description = "Returns all questionnaire templates for the authenticated professional (without questions).";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        var questionnaires = await db.Questionnaires
            .Where(q => q.ProfessionalId == userGuid)
            .Include(q => q.Questions)
            .OrderByDescending(q => q.DateCreated)
            .ToListAsync(ct);

        await Send.OkAsync(new GetTrainerQuestionnairesResponse
        {
            Questionnaires = questionnaires.Select(q => new QuestionnaireSummaryDto
            {
                PublicId = q.PublicId,
                Title = q.Title,
                Description = q.Description,
                IsActive = q.IsActive,
                IsDefault = q.IsDefault,
                QuestionCount = q.Questions.Count,
                DateCreated = q.DateCreated,
            }).ToList(),
        }, ct);
    }
}
