using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.GetClientSubmittedResponses;

/// <summary>
/// Returns all submitted questionnaire responses for the authenticated client,
/// grouped by professional link. Used by the mobile profile screen to show
/// questionnaire answers under each coach.
/// </summary>
public class GetClientSubmittedResponsesEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetClientSubmittedResponsesResponse>
{
    public override void Configure()
    {
        Get("/client/questionnaires/submitted");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get all submitted questionnaires grouped by professional";
            s.Description = "Returns submitted questionnaire responses across all professional links.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        // Get all submitted responses with professional info
        var responses = await db.QuestionnaireResponses
            .AsNoTracking()
            .Include(r => r.Answers).ThenInclude(a => a.Question)
            .Include(r => r.Questionnaire)
            .Include(r => r.Link).ThenInclude(l => l.ProfessionalProfile).ThenInclude(pp => pp.User)
            .Where(r => r.ClientId == userGuid
                     && r.Status == QuestionnaireResponseStatus.Submitted)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);

        // Group by professional link
        var grouped = responses
            .GroupBy(r => r.LinkId)
            .Select(g =>
            {
                var link = g.First().Link;
                return new CoachQuestionnairesItem
                {
                    LinkPublicId = link.PublicId,
                    ProfessionalName = $"{link.ProfessionalProfile.User.FirstName} {link.ProfessionalProfile.User.LastName}",
                    ProfessionalRole = link.ProfessionalRole.ToString(),
                    Responses = g.Select(r => new SubmittedResponseItem
                    {
                        ResponsePublicId = r.PublicId,
                        QuestionnaireTitle = r.Questionnaire.Title,
                        SubmittedAt = r.SubmittedAt,
                        Answers = r.Answers
                            .OrderBy(a => a.Question.OrderIndex)
                            .Where(a => a.Question.Type != "section")
                            .Select(a => new SubmittedAnswerItem
                            {
                                Label = a.Question.Label,
                                Type = a.Question.Type,
                                ValueText = a.ValueText,
                                ValueNumber = a.ValueNumber,
                                ValueJson = a.ValueJson,
                                Config = a.Question.Config,
                            }).ToList(),
                    }).ToList(),
                };
            }).ToList();

        await Send.OkAsync(new GetClientSubmittedResponsesResponse { Coaches = grouped }, ct);
    }
}
