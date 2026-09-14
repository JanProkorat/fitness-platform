using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Progress.GetWeeklyOverview;

/// <summary>
/// Endpoint for retrieving the authenticated client's weekly progress overview.
/// Returns compliance, average macros, and streak for the current week (Monday–Sunday).
/// </summary>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class GetWeeklyOverviewEndpoint(IComplianceService complianceService, IApplicationDbContext db, TimeProvider timeProvider)
    : EndpointWithoutRequest<GetWeeklyOverviewResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/progress/weekly");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get weekly overview";
            s.Description = "Returns the authenticated client's progress overview for the current week.";
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

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // Resolve the client's local calendar day (#935) rather than the server's UTC day — a
        // Prague client at 00:30 local Monday (22:30 UTC Sunday) must see the NEW week's overview,
        // not last week's.
        var todayLocalUtc = await db.ResolveClientLocalDateUtcAsync(clientId, timeProvider.GetUtcNow().UtcDateTime, ct);

        // Calculate Monday of the current week (handle Sunday as day 0)
        var dayOfWeek = todayLocalUtc.DayOfWeek;
        var daysToMonday = dayOfWeek == DayOfWeek.Sunday ? 6 : (int)dayOfWeek - 1;
        var weekStart = todayLocalUtc.AddDays(-daysToMonday);
        var weekEnd = weekStart.AddDays(6);

        var compliance = await complianceService.CalculateComplianceAsync(clientId, weekStart, weekEnd, ct);
        var streak = await complianceService.CalculateStreakAsync(clientId, DateOnly.FromDateTime(todayLocalUtc), ct);
        var averageMacros = await complianceService.CalculateAverageMacrosAsync(clientId, weekStart, weekEnd, ct);

        await Send.OkAsync(new GetWeeklyOverviewResponse
        {
            WeekStart = weekStart,
            WeekEnd = weekEnd,
            CompliancePercent = compliance.CompliancePercent,
            MealsPlanned = compliance.MealsPlanned,
            MealsLogged = compliance.MealsLogged,
            AverageDailyMacros = averageMacros,
            CurrentStreak = streak
        }, ct);
    }
}
