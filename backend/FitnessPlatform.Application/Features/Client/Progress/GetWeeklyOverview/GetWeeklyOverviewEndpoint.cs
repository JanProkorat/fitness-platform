using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Features.Client.Progress.GetWeeklyOverview;

/// <summary>
/// Endpoint for retrieving the authenticated client's weekly progress overview.
/// Returns compliance, average macros, and streak for the current week (Monday–Sunday).
/// </summary>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
public class GetWeeklyOverviewEndpoint(IComplianceService complianceService)
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

        var clientId = Guid.Parse(userId);
        var today = DateTime.UtcNow.Date;

        // Calculate Monday of the current week (handle Sunday as day 0)
        var dayOfWeek = today.DayOfWeek;
        var daysToMonday = dayOfWeek == DayOfWeek.Sunday ? 6 : (int)dayOfWeek - 1;
        var weekStart = today.AddDays(-daysToMonday);
        var weekEnd = weekStart.AddDays(6);

        var compliance = await complianceService.CalculateComplianceAsync(clientId, weekStart, weekEnd, ct);
        var streak = await complianceService.CalculateStreakAsync(clientId, ct);
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
