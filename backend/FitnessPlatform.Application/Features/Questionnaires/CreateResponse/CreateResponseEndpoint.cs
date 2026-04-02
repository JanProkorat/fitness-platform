using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.CreateResponse;

public class CreateResponseEndpoint(IApplicationDbContext db)
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

        var link = await db.ClientProfessionalLinks
            .Where(l => l.ClientProfileId == clientProfile.Id
                        && l.ProfessionalProfileId == professionalProfile.Id
                        && l.IsActive)
            .FirstOrDefaultAsync(ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // 3. Create the response
        var response = new QuestionnaireResponse
        {
            PublicId = Guid.NewGuid(),
            QuestionnaireId = questionnaire.Id,
            ClientId = userGuid,
            ProfessionalId = questionnaire.ProfessionalId,
            LinkId = link.Id,
            Status = QuestionnaireResponseStatus.InProgress,
        };

        db.QuestionnaireResponses.Add(response);
        await db.SaveChangesAsync(ct);

        await HttpContext.Response.SendAsync(
            new { ResponsePublicId = response.PublicId },
            201, cancellation: ct);
    }
}
