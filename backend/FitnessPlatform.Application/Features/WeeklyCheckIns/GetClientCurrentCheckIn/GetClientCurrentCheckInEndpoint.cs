using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCurrentCheckIn;

/// <summary>
/// Returns the active (not dismissed, not yet reviewed) check-in(s) for a specific client,
/// regardless of which calendar week they were scheduled for.
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
            s.Summary = "Get the active check-in for a client (trainer)";
            s.Description =
                "Returns the check-in(s) for the given client that are not dismissed by the " +
                "client and not yet reviewed by the trainer (pending, responded, or expired), " +
                "week-agnostic, filtered to the authenticated professional. Optionally filter " +
                "by profession.";
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

        var query = db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c =>
                c.ClientUserId == req.ClientUserId &&
                c.ProfessionalUserId == professionalUserId &&
                c.DismissedByClientAt == null &&
                c.ReviewedByTrainerAt == null);

        if (!string.IsNullOrWhiteSpace(req.Profession) &&
            Enum.TryParse<Profession>(req.Profession, ignoreCase: true, out var professionFilter))
        {
            query = query.Where(c => c.Profession == professionFilter);
        }

        var checkIns = await query
            .OrderByDescending(c => c.WeekStartDate)
            .ThenBy(c => c.Profession)
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
