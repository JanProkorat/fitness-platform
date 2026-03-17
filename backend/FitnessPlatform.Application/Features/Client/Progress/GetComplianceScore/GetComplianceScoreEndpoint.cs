using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Features.Client.Progress.GetComplianceScore;

/// <summary>
/// Endpoint for retrieving the authenticated client's compliance score over a date range.
/// Returns compliance percentage, meal counts, and current streak.
/// </summary>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
public class GetComplianceScoreEndpoint(IComplianceService complianceService)
    : Endpoint<GetComplianceScoreRequest, GetComplianceScoreResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/progress/compliance");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get compliance score";
            s.Description = "Returns the authenticated client's meal compliance score and streak for a given date range.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetComplianceScoreRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);
        var from = req.From ?? DateTime.UtcNow.Date.AddDays(-7);
        var to = req.To ?? DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);

        var compliance = await complianceService.CalculateComplianceAsync(clientId, from, to, ct);
        var streak = await complianceService.CalculateStreakAsync(clientId, ct);

        await Send.OkAsync(new GetComplianceScoreResponse
        {
            CompliancePercent = compliance.CompliancePercent,
            MealsPlanned = compliance.MealsPlanned,
            MealsLogged = compliance.MealsLogged,
            CurrentStreak = streak,
            From = from,
            To = to
        }, ct);
    }
}
