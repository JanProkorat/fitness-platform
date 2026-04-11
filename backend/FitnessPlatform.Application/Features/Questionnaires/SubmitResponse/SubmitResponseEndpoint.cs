using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
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
            s.Description = "Marks a questionnaire response as submitted.";
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

        // 3. Verify status allows submission (Pending or InProgress)
        if (response.Status != QuestionnaireResponseStatus.Pending && response.Status != QuestionnaireResponseStatus.InProgress)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Response cannot be submitted in its current state." },
                409, cancellation: ct);
            return;
        }

        // 4. Update status
        response.Status = QuestionnaireResponseStatus.Submitted;
        response.SubmittedAt = DateTime.UtcNow;

        // Map answers to client profile and notify professional (also calls SaveChangesAsync)
        await mapper.MapResponseToProfileAsync(response, ct);

        await Send.OkAsync(new { Message = "Questionnaire submitted successfully." }, ct);
    }
}
