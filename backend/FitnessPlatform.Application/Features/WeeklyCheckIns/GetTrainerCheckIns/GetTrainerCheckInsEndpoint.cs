using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetTrainerCheckIns;

/// <summary>
/// Returns check-ins for the caller's clients, either the active (week-agnostic) set or a
/// specific ISO week's check-ins.
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
            s.Summary = "List check-ins for the trainer";
            s.Description =
                "weekStartDate is optional (YYYY-MM-DD, must be a Monday). When omitted, " +
                "returns the active set for the authenticated trainer's clients — check-ins " +
                "that are not dismissed by the client and not yet reviewed by the trainer, " +
                "across all weeks. When provided, preserves the exact-week behavior (responded " +
                "and pending, not dismissed, for that specific week) for a future history view.";
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

        var query = db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c => c.ProfessionalUserId == professionalUserId);

        query = req.WeekStartDate.HasValue
            ? query.Where(c =>
                c.WeekStartDate == req.WeekStartDate.Value &&
                c.DismissedByClientAt == null)
            : query.Where(c =>
                c.DismissedByClientAt == null &&
                c.ReviewedByTrainerAt == null);

        var checkIns = await query
            .Include(c => c.ClientUser)
            .OrderBy(c => c.ClientUser.LastName)
                .ThenBy(c => c.ClientUser.FirstName)
            .Select(c => new TrainerCheckInDto
            {
                Id = c.Id,
                ClientUserId = c.ClientUserId,
                // Null-safe correlated subquery: FirstOrDefault() on a Guid sequence
                // yields Guid.Empty if the client has no ClientProfile row, rather than
                // throwing — avoids an inner join that could silently drop the check-in.
                ClientPublicId = db.ClientProfiles
                    .Where(cp => cp.UserId == c.ClientUserId)
                    .Select(cp => cp.PublicId)
                    .FirstOrDefault(),
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
