using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Authorization;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Extensions;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Questionnaires.MarkClientFormSeen;

/// <summary>
/// Marks a client's submitted form as seen by the calling coach. A repeat call keeps the first timestamp.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="linkAuthorizationService">Resolves the caller's live link to the client.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
internal sealed class MarkClientFormSeenEndpoint(
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    TimeProvider timeProvider)
    : Endpoint<MarkClientFormSeenRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/clients/{ClientPublicId}/forms/{ResponsePublicId}/seen");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Mark a client's form as seen";
            s.Description = "Records when the caller first opened a submitted form. Calling it again changes nothing.";
            s.Responses[StatusCodes.Status204NoContent] = "Marked as seen, or already seen";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] =
                "Unknown client or response, no live link, or the response is not the caller's for this client";
            s.Responses[StatusCodes.Status409Conflict] = "The client has not submitted the form yet";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkClientFormSeenRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var coachUserId = Guid.Parse(userId);

        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            coachUserId, req.ClientPublicId, ct);

        if (capabilities is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientUserId = await db.ClientProfiles
            .AsNoTracking()
            .Where(profile => profile.PublicId == req.ClientPublicId)
            .Select(profile => (Guid?)profile.UserId)
            .FirstOrDefaultAsync(ct);

        var response = clientUserId is null
            ? null
            : await db.QuestionnaireResponses.FirstOrDefaultAsync(
                found => found.PublicId == req.ResponsePublicId
                         && found.ClientId == clientUserId
                         && found.ProfessionalId == coachUserId,
                ct);

        if (response is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (response.Status != QuestionnaireResponseStatus.Submitted)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.QuestionnaireResponseNotSubmitted,
                "The client has not submitted this form yet.",
                ct);
            return;
        }

        if (response.ReviewedByCoachAtUtc is null)
        {
            response.ReviewedByCoachAtUtc = timeProvider.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }

        await Send.NoContentAsync(ct);
    }
}
