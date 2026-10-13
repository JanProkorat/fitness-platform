using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
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
    public QuestionnaireType Type { get; set; }
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
    public int QuestionCount { get; set; }

    /// <summary>Distinct clients with a non-cancelled response to this form.</summary>
    public int UsedForClientCount { get; set; }
    public DateTime DateCreated { get; set; }

    /// <summary>Last edit time: the update timestamp, or the creation time when never edited.</summary>
    public DateTime EditedAt { get; set; }
}

public class GetTrainerQuestionnairesEndpoint(IApplicationDbContext db)
    : Endpoint<GetTrainerQuestionnairesRequest, GetTrainerQuestionnairesResponse>
{
    public override void Configure()
    {
        Get("/trainer/questionnaires");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List trainer questionnaires";
            s.Description = "Returns the authenticated professional's questionnaire templates (without questions), optionally filtered by type and title search.";
            s.Responses[StatusCodes.Status200OK] = "Questionnaire summaries";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid type filter";
        });
    }

    public override async Task HandleAsync(GetTrainerQuestionnairesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var query = db.Questionnaires
            .AsNoTracking()
            .Where(q => q.ProfessionalId == userGuid);

        if (req.Type.HasValue)
        {
            query = query.Where(q => q.Type == req.Type.Value);
        }

        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            var pattern = "%" + EscapeLikePattern(req.Search.Trim()) + "%";
            query = query.Where(q => EF.Functions.ILike(q.Title, pattern, "\\"));
        }

        var rows = await query
            .OrderByDescending(q => q.DateCreated)
            .Select(q => new QuestionnaireSummaryDto
            {
                PublicId = q.PublicId,
                Title = q.Title,
                Description = q.Description,
                Type = q.Type,
                IsActive = q.IsActive,
                IsDefault = q.IsDefault,
                QuestionCount = q.Questions.Count,
                DateCreated = q.DateCreated,
                EditedAt = q.DateUpdated ?? q.DateCreated,
            })
            .ToListAsync(ct);

        if (rows.Count > 0)
        {
            var publicIds = rows.Select(row => row.PublicId).ToList();

            var usedCounts = await db.QuestionnaireResponses
                .AsNoTracking()
                .Where(r => publicIds.Contains(r.Questionnaire.PublicId)
                    && r.Status != QuestionnaireResponseStatus.Cancelled)
                .GroupBy(r => r.Questionnaire.PublicId)
                .Select(g => new { PublicId = g.Key, Clients = g.Select(r => r.ClientId).Distinct().Count() })
                .ToDictionaryAsync(x => x.PublicId, x => x.Clients, ct);

            foreach (var row in rows)
            {
                row.UsedForClientCount = usedCounts.GetValueOrDefault(row.PublicId);
            }
        }

        await Send.OkAsync(new GetTrainerQuestionnairesResponse { Questionnaires = rows }, ct);
    }

    private static string EscapeLikePattern(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
