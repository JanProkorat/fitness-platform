using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.WeeklyCheckIns.GetCheckInDetail;

/// <summary>
/// Returns the summary of a single check-in of the caller's current collaboration with a client.
/// Returns 404 when it is not a check-in, belongs to another professional, or is from an earlier collaboration.
/// </summary>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock, used to tell an expired check-in from a pending one.</param>
public class GetCheckInDetailEndpoint(IApplicationDbContext db, TimeProvider timeProvider)
    : Endpoint<GetCheckInDetailRequest, GetCheckInDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/weekly-check-ins/{id}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get check-in detail (trainer)";
            s.Description = "Returns the summary of a single check-in, addressed by the public id of its form response.";
            s.Responses[StatusCodes.Status200OK] = "Check-in detail";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "Not a check-in of the caller's current collaboration";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetCheckInDetailRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalUserId = Guid.Parse(userId);

        var row = await db.QuestionnaireResponses
            .AsNoTracking()
            .CurrentCollaborationCheckIns()
            .Where(r => r.PublicId == req.Id && r.ProfessionalId == professionalUserId)
            .Select(r => new
            {
                r.PublicId,
                r.ClientId,
                ClientName = r.Link.ClientProfile.User.FirstName + " " + r.Link.ClientProfile.User.LastName,
                r.Link.ProfessionalRole,
                r.CheckInWeekStart,
                r.DateCreated,
                r.Status,
                r.SubmittedAt,
                r.CheckInDueAtUtc,
                r.ReviewedByCoachAtUtc,
            })
            .FirstOrDefaultAsync(ct);

        if (row is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;

        await Send.OkAsync(new GetCheckInDetailResponse
        {
            Id = row.PublicId,
            ClientUserId = row.ClientId,
            ClientName = row.ClientName,
            ProfessionalUserId = professionalUserId,
            Profession = CheckInResponses.ProfessionOf(row.ProfessionalRole).ToString(),
            WeekStartDate = CheckInResponses.WeekStartOf(row.CheckInWeekStart, row.DateCreated),
            Flags = [],
            Note = null,
            HungerScore = null,
            SentAt = row.DateCreated,
            RespondedAt = row.SubmittedAt,
            DismissedByClientAt = null,
            ReviewedByTrainerAt = row.ReviewedByCoachAtUtc,
            Status = CheckInResponses.ResolveStatus(row.Status, row.ReviewedByCoachAtUtc, row.CheckInDueAtUtc, nowUtc).ToString(),
            DueAt = row.CheckInDueAtUtc,
        }, ct);
    }
}
