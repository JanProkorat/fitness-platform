using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetTrainerCheckIns;

/// <summary>
/// Returns all responded and pending (not dismissed) check-ins for the caller's clients
/// for the specified ISO week.
/// </summary>
public class GetTrainerCheckInsEndpoint(IApplicationDbContext db)
    : Endpoint<GetTrainerCheckInsRequest, GetTrainerCheckInsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/weekly-check-ins");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List check-ins for a week (trainer)";
            s.Description =
                "Returns responded and pending (not dismissed) check-ins for the authenticated " +
                "trainer's clients for the given week. Pass weekStartDate as YYYY-MM-DD (must be a Monday).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainerCheckInsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalUserId = Guid.Parse(userId);

        var checkIns = await db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c =>
                c.ProfessionalUserId == professionalUserId &&
                c.WeekStartDate == req.WeekStartDate &&
                c.DismissedByClientAt == null)
            .Include(c => c.ClientUser)
            .OrderBy(c => c.ClientUser.LastName)
                .ThenBy(c => c.ClientUser.FirstName)
            .Select(c => new TrainerCheckInDto
            {
                Id = c.Id,
                ClientUserId = c.ClientUserId,
                ClientName = c.ClientUser.FirstName + " " + c.ClientUser.LastName,
                Profession = c.Profession.ToString(),
                WeekStartDate = c.WeekStartDate,
                Flags = c.Flags,
                Note = c.Note,
                SentAt = c.SentAt,
                RespondedAt = c.RespondedAt,
                DismissedByClientAt = c.DismissedByClientAt,
                ReviewedByTrainerAt = c.ReviewedByTrainerAt,
                Status = c.Status.ToString(),
                DueAt = c.DueAt
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetTrainerCheckInsResponse { CheckIns = checkIns }, ct);
    }
}
