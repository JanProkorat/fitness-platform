using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.GetAll;

/// <summary>
/// Endpoint for retrieving pending invitations for the authenticated professional.
/// </summary>
/// <param name="db">Database context.</param>
public class GetPendingInvitesEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetPendingInvitesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/pending-invites");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Summary(s =>
        {
            s.Summary = "Get pending invitations";
            s.Description = "Returns a list of pending (not yet accepted) invitations for the authenticated professional.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var invites = await db.PendingInvites
            .AsNoTracking()
            .Include(pi => pi.Questionnaire)
            .Where(pi => pi.ProfessionalProfileId == professionalProfile.Id && !pi.IsAccepted)
            .OrderByDescending(pi => pi.SentAt)
            .Select(pi => new PendingInviteDto
            {
                PublicId = pi.PublicId,
                FirstName = pi.FirstName,
                LastName = pi.LastName,
                Email = pi.Email,
                Message = pi.Message,
                SentAt = pi.SentAt,
                IsAccepted = pi.IsAccepted,
                QuestionnairePublicId = pi.Questionnaire != null ? pi.Questionnaire.PublicId : null,
                QuestionnaireTitle = pi.Questionnaire != null ? pi.Questionnaire.Title : null
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetPendingInvitesResponse
        {
            Invites = invites
        }, ct);
    }
}
