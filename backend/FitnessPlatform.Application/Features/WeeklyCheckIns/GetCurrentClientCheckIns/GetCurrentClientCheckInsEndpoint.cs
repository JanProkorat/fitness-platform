using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetCurrentClientCheckIns;

/// <summary>
/// Returns the active (not yet responded, not dismissed) weekly check-ins for the
/// authenticated client in the current ISO week. Maximum 2 items (one per profession).
/// </summary>
public class GetCurrentClientCheckInsEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetCurrentClientCheckInsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/weekly-check-ins/current");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get current week's active check-ins (client)";
            s.Description =
                "Returns up to 2 active weekly check-ins (not responded, not dismissed) " +
                "for the authenticated client in the current ISO week.";
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

        var clientUserId = Guid.Parse(userId);

        // Compute ISO-week Monday of the current week.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysFromMonday = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var weekMonday = today.AddDays(-daysFromMonday);

        var checkIns = await db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c =>
                c.ClientUserId == clientUserId &&
                c.WeekStartDate == weekMonday &&
                c.RespondedAt == null &&
                c.DismissedByClientAt == null &&
                c.Status != WeeklyCheckInStatus.Expired)
            .Include(c => c.ProfessionalUser)
            .OrderBy(c => c.Profession)
            .Select(c => new CheckInSummary
            {
                Id = c.Id,
                ProfessionalUserId = c.ProfessionalUserId,
                ProfessionalName = c.ProfessionalUser.FirstName + " " + c.ProfessionalUser.LastName,
                Profession = c.Profession.ToString(),
                WeekStartDate = c.WeekStartDate,
                SentAt = c.SentAt
            })
            .ToListAsync(ct);

        await Send.OkAsync(new GetCurrentClientCheckInsResponse { CheckIns = checkIns }, ct);
    }
}
