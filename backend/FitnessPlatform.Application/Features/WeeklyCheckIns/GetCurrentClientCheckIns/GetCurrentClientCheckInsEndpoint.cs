using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetCurrentClientCheckIns;

/// <summary>
/// Returns the client's active weekly check-ins — active meaning not yet responded, not
/// dismissed, not expired, and still within the response deadline (<c>DueAt</c>). This is
/// independent of calendar-week boundaries: check-ins are prospective (they cover the
/// upcoming week), so the response window spans the tail of the current week rather than
/// the week named by <c>WeekStartDate</c>. Maximum 2 items (one per profession).
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
            s.Summary = "Get active check-ins (client)";
            s.Description =
                "Returns up to 2 active weekly check-ins (not responded, not dismissed, not " +
                "expired, and still within the response deadline) for the authenticated client.";
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
        var now = DateTime.UtcNow;

        var checkIns = await db.WeeklyCheckIns
            .AsNoTracking()
            .Where(c =>
                c.ClientUserId == clientUserId &&
                c.RespondedAt == null &&
                c.DismissedByClientAt == null &&
                c.Status != WeeklyCheckInStatus.Expired &&
                (c.DueAt == null || c.DueAt > now))
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
