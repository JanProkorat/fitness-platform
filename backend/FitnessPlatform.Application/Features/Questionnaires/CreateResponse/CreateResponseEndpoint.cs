using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.CreateResponse;

public class CreateResponseEndpoint(IApplicationDbContext db, IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<CreateResponseRequest>
{
    public override void Configure()
    {
        Post("/client/questionnaire/response");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Create questionnaire response";
            s.Description = "Creates a new in-progress questionnaire response for the authenticated client.";
        });
    }

    public override async Task HandleAsync(CreateResponseRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        // 1. Find the questionnaire by PublicId
        var questionnaire = await db.Questionnaires
            .FirstOrDefaultAsync(q => q.PublicId == req.QuestionnairePublicId, ct);

        if (questionnaire is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 2. Find the client's link to the professional
        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(p => p.UserId == questionnaire.ProfessionalId, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // The professional and client profiles are already confirmed to exist above, so a null
        // result here can only mean "no active link" — not "no professional/client profile". No
        // capability flag is required, matching the pre-migration IsActive-only presence check.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
            questionnaire.ProfessionalId, userGuid, ct);

        if (capabilities is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // The service exposes only the link's capability flags, never its own database Id — the
        // new response still needs that Id as an FK, so it is looked up separately here. The link
        // is guaranteed to exist and be active because the capability lookup above just confirmed it.
        var linkId = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ClientProfileId == clientProfile.Id
                        && l.ProfessionalProfileId == professionalProfile.Id
                        && l.IsActive)
            .Select(l => l.Id)
            .FirstAsync(ct);

        // 3. Create the response
        var response = new QuestionnaireResponse
        {
            PublicId = Guid.NewGuid(),
            QuestionnaireId = questionnaire.Id,
            ClientId = userGuid,
            ProfessionalId = questionnaire.ProfessionalId,
            LinkId = linkId,
            Status = QuestionnaireResponseStatus.InProgress,
        };

        db.QuestionnaireResponses.Add(response);
        await db.SaveChangesAsync(ct);

        await HttpContext.Response.SendAsync(
            new { ResponsePublicId = response.PublicId },
            201, cancellation: ct);
    }
}
