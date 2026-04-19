using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCurrentCheckIn;

/// <summary>
/// Returns the latest check-in(s) for a specific client in the current ISO week.
/// Used by the plan-editor banner to decide which state to render.
/// Only returns check-ins that belong to the authenticated professional.
/// </summary>
public class GetClientCurrentCheckInEndpoint(IApplicationDbContext db)
    : Endpoint<GetClientCurrentCheckInRequest, GetClientCurrentCheckInResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{clientUserId}/weekly-check-ins/current");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get current week's check-in for a client (trainer)";
            s.Description =
                "Returns the check-in(s) for the given client in the current ISO week, " +
                "filtered to the authenticated professional. Optionally filter by profession.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientCurrentCheckInRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalUserId = Guid.Parse(userId);

        // Compute ISO-week Monday of the current week.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysFromMonday = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var weekMonday = today.AddDays(-daysFromMonday);

        var query = db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c =>
                c.ClientUserId == req.ClientUserId &&
                c.ProfessionalUserId == professionalUserId &&
                c.WeekStartDate == weekMonday);

        if (!string.IsNullOrWhiteSpace(req.Profession) &&
            Enum.TryParse<Profession>(req.Profession, ignoreCase: true, out var professionFilter))
        {
            query = query.Where(c => c.Profession == professionFilter);
        }

        var checkIns = await query
            .OrderBy(c => c.Profession)
            .Select(c => new ClientCheckInDto
            {
                Id = c.Id,
                Profession = c.Profession.ToString(),
                WeekStartDate = c.WeekStartDate,
                Flags = c.Flags,
                Note = c.Note,
                SentAt = c.SentAt,
                RespondedAt = c.RespondedAt,
                DismissedByClientAt = c.DismissedByClientAt,
                ReviewedByTrainerAt = c.ReviewedByTrainerAt
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetClientCurrentCheckInResponse { CheckIns = checkIns }, ct);
    }
}
