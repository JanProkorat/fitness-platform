using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetCheckInDetail;

/// <summary>
/// Returns full detail for a single check-in.
/// Returns 404 if the record doesn't exist; 403 if it belongs to a different professional.
/// </summary>
public class GetCheckInDetailEndpoint(IApplicationDbContext db)
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
            s.Description = "Returns full detail for a single weekly check-in. 404 if not found; 403 if owned by another professional.";
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

        var checkIn = await db.WeeklyCheckIns
            .AsNoTracking()
            .Include(c => c.ClientUser)
            .FirstOrDefaultAsync(c => c.Id == req.Id, ct);

        if (checkIn is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (checkIn.ProfessionalUserId != professionalUserId)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        await Send.OkAsync(new GetCheckInDetailResponse
        {
            Id = checkIn.Id,
            ClientUserId = checkIn.ClientUserId,
            ClientName = $"{checkIn.ClientUser.FirstName} {checkIn.ClientUser.LastName}",
            ProfessionalUserId = checkIn.ProfessionalUserId,
            Profession = checkIn.Profession.ToString(),
            WeekStartDate = checkIn.WeekStartDate,
            Flags = checkIn.Flags,
            Note = checkIn.Note,
            SentAt = checkIn.SentAt,
            RespondedAt = checkIn.RespondedAt,
            DismissedByClientAt = checkIn.DismissedByClientAt,
            ReviewedByTrainerAt = checkIn.ReviewedByTrainerAt,
            Status = checkIn.Status.ToString(),
            DueAt = checkIn.DueAt
        }, ct);
    }
}
