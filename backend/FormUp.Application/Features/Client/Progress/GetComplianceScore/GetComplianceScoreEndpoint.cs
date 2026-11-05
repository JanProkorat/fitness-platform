using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Extensions;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Client.Progress.GetComplianceScore;

/// <summary>
/// Endpoint for retrieving the authenticated client's compliance score over a date range.
/// Returns compliance percentage, meal counts, and current streak.
/// </summary>
/// <param name="complianceService">Service for calculating compliance metrics.</param>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class GetComplianceScoreEndpoint(IComplianceService complianceService, IApplicationDbContext db, TimeProvider timeProvider)
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
            s.Responses[StatusCodes.Status200OK] = "Compliance score";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "Client profile not found";
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

        // Resolve the client's local calendar day (#935) rather than the server's UTC day for the
        // default range and the streak anchor — see GetWeeklyOverviewEndpoint for the same fix.
        var todayLocalUtc = await db.ResolveClientLocalDateUtcAsync(clientId, timeProvider.GetUtcNow().UtcDateTime, ct);
        var from = req.From ?? todayLocalUtc.AddDays(-7);
        var to = req.To ?? todayLocalUtc.AddDays(1).AddTicks(-1);

        var compliance = await complianceService.CalculateComplianceAsync(clientId, from, to, ct);
        var streak = await complianceService.CalculateStreakAsync(clientId, DateOnly.FromDateTime(todayLocalUtc), ct);

        await Send.OkAsync(new GetComplianceScoreResponse
        {
            CompliancePercent = compliance.CompliancePercent,
            MealsPlanned = compliance.MealsPlanned,
            MealsLogged = compliance.MealsLogged,
            MealsPartlyEaten = compliance.MealsPartlyEaten,
            MealsEatenShare = compliance.MealsEatenShare,
            CurrentStreak = streak,
            From = from,
            To = to
        }, ct);
    }
}
