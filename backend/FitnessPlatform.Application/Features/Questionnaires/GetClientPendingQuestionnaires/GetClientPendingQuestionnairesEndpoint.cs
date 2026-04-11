using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.GetClientPendingQuestionnaires;

/// <summary>
/// Returns all pending/in-progress questionnaires for the client — one per active
/// professional link. Allows the mobile app to show a list when the client has
/// multiple coaches.
/// </summary>
public class GetClientPendingQuestionnairesEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetClientPendingQuestionnairesResponse>
{
    public override void Configure()
    {
        Get("/client/questionnaires/pending");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get all pending questionnaires for the client";
            s.Description = "Returns pending/in-progress questionnaires across all active professional links.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Get all active professional links
        var links = await db.ClientProfessionalLinks
            .Include(l => l.ProfessionalProfile).ThenInclude(pp => pp.User)
            .Where(l => l.ClientProfileId == clientProfile.Id && l.IsActive)
            .ToListAsync(ct);

        var items = new List<PendingQuestionnaireItem>();

        foreach (var link in links)
        {
            // Skip links where the client already submitted a questionnaire response.
            // Check both by LinkId and by ProfessionalId (for legacy responses
            // created before LinkId was tracked, which have LinkId == 0).
            var hasSubmitted = await db.QuestionnaireResponses
                .AsNoTracking()
                .AnyAsync(r =>
                    r.ClientId == userGuid
                    && r.Status == QuestionnaireResponseStatus.Submitted
                    && (r.LinkId == link.Id || r.ProfessionalId == link.ProfessionalProfile.UserId), ct);

            if (hasSubmitted) continue;

            // Check for an existing pending/in-progress response on this link
            var existingResponse = await db.QuestionnaireResponses
                .AsNoTracking()
                .FirstOrDefaultAsync(r =>
                    r.ClientId == userGuid
                    && r.LinkId == link.Id
                    && (r.Status == QuestionnaireResponseStatus.Pending || r.Status == QuestionnaireResponseStatus.InProgress), ct);

            // Resolve which questionnaire applies for this link
            Domain.Entities.Questionnaire? questionnaire = null;

            if (link.QuestionnaireId.HasValue)
            {
                questionnaire = await db.Questionnaires
                    .AsNoTracking()
                    .FirstOrDefaultAsync(q => q.Id == link.QuestionnaireId.Value && q.IsActive, ct);
            }

            questionnaire ??= await db.Questionnaires
                .AsNoTracking()
                .FirstOrDefaultAsync(q => q.ProfessionalId == link.ProfessionalProfile.UserId && q.IsDefault && q.IsActive, ct);

            if (questionnaire is null && existingResponse is null) continue;

            items.Add(new PendingQuestionnaireItem
            {
                LinkPublicId = link.PublicId,
                ProfessionalName = $"{link.ProfessionalProfile.User.FirstName} {link.ProfessionalProfile.User.LastName}",
                ProfessionalRole = link.ProfessionalRole.ToString(),
                QuestionnairePublicId = questionnaire?.PublicId,
                QuestionnaireTitle = questionnaire?.Title,
                QuestionCount = questionnaire?.Questions.Count ?? 0,
                ResponsePublicId = existingResponse?.PublicId,
                ResponseStatus = existingResponse?.Status.ToString(),
            });
        }

        await Send.OkAsync(new GetClientPendingQuestionnairesResponse { Items = items }, ct);
    }
}
